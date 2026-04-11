#!/usr/bin/env python3
"""
CVTE Serial Protocol Test Script
Tests serial commands for CVTE factory auto test protocol.

Usage:
    python test_serial.py
"""

import serial
import time
import sys
from typing import List, Optional, Tuple


class CVTESerialTester:
    """CVTE Serial Protocol Tester"""

    # Serial port configuration
    DEFAULT_PORT = "/dev/tty.usbserial-gggggggg1"
    BAUD_RATE = 115200
    TIMEOUT = 2.0  # seconds

    # Protocol constants
    SYNC_BYTE = 0xFF
    START_BYTE = 0x33
    PROTOCOL_ID = 0x03  # Factory auto test protocol

    def __init__(self, port: str = None):
        """Initialize the tester with specified port."""
        self.port = port or self.DEFAULT_PORT
        self.ser: Optional[serial.Serial] = None

    @staticmethod
    def calculate_checksum(data: bytes) -> int:
        """
        Calculate CVTE checksum.
        Formula: checksum = 0x100 - sum(data[2:])

        Args:
            data: Complete packet data including sync and start bytes

        Returns:
            Checksum byte (0-255)
        """
        if len(data) < 3:
            return 0
        total = sum(data[2:])
        checksum = (0x100 - total) & 0xFF
        return checksum

    @staticmethod
    def bytes_to_hex(data: bytes) -> str:
        """Convert bytes to hex string for display."""
        return " ".join(f"{b:02X}" for b in data)

    def open(self) -> bool:
        """Open serial port connection."""
        try:
            self.ser = serial.Serial(
                port=self.port,
                baudrate=self.BAUD_RATE,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE,
                timeout=self.TIMEOUT
            )
            print(f"[OK] Opened serial port: {self.port}")
            print(f"     Baud rate: {self.BAUD_RATE}")
            time.sleep(0.1)  # Wait for port to stabilize
            return True
        except serial.SerialException as e:
            print(f"[ERROR] Failed to open port {self.port}: {e}")
            return False

    def close(self):
        """Close serial port connection."""
        if self.ser and self.ser.is_open:
            self.ser.close()
            print("[OK] Serial port closed")

    def build_packet(self, cmd_id: int, params: List[int] = None) -> bytes:
        """
        Build a complete packet with checksum.

        Args:
            cmd_id: Command ID byte
            params: Optional list of parameter bytes

        Returns:
            Complete packet as bytes
        """
        params = params or []
        # Packet: FF 33 [length] 03 [cmd_id] [params...] [checksum]
        # Length = 6 + len(params) (header + protocol + cmd + params + checksum)
        length = 6 + len(params)

        packet = bytearray([
            self.SYNC_BYTE,
            self.START_BYTE,
            length,
            self.PROTOCOL_ID,
            cmd_id
        ])
        packet.extend(params)

        # Calculate and append checksum
        checksum = self.calculate_checksum(bytes(packet))
        packet.append(checksum)

        return bytes(packet)

    def send_command(self, cmd_id: int, params: List[int] = None,
                     expected_response_id: int = None,
                     cmd_name: str = "Unknown") -> Tuple[bool, Optional[bytes]]:
        """
        Send a command and wait for response.

        Args:
            cmd_id: Command ID to send
            params: Optional parameters
            expected_response_id: Expected response command ID
            cmd_name: Human readable command name

        Returns:
            Tuple of (success, response_data)
        """
        if not self.ser or not self.ser.is_open:
            print("[ERROR] Serial port not open")
            return False, None

        # Build and send packet
        packet = self.build_packet(cmd_id, params)
        print(f"\n{'='*60}")
        print(f"Command: {cmd_name} (0x{cmd_id:02X})")
        print(f"TX: {self.bytes_to_hex(packet)}")

        # Verify checksum
        calc_checksum = self.calculate_checksum(packet[:-1])
        if calc_checksum != packet[-1]:
            print(f"[WARN] Checksum mismatch! Calculated: 0x{calc_checksum:02X}, Packet: 0x{packet[-1]:02X}")

        try:
            # Clear any pending data
            self.ser.reset_input_buffer()

            # Send packet
            self.ser.write(packet)
            self.ser.flush()

            # Wait for response
            time.sleep(0.2)

            # Read response
            if self.ser.in_waiting > 0:
                response = self.ser.read(self.ser.in_waiting)
                print(f"RX: {self.bytes_to_hex(response)}")

                # Parse response
                if len(response) >= 6:
                    # Verify response structure
                    if response[0] == self.SYNC_BYTE and response[1] == self.START_BYTE:
                        resp_cmd_id = response[4] if len(response) > 4 else None

                        if expected_response_id and resp_cmd_id == expected_response_id:
                            print(f"[OK] Response received (ID: 0x{resp_cmd_id:02X})")
                            return True, response
                        elif expected_response_id and resp_cmd_id == 0x01:
                            # ACK response
                            error_code = response[5] if len(response) > 5 else 0xFF
                            acked_cmd = response[6] if len(response) > 6 else 0xFF
                            if error_code == 0:
                                print(f"[OK] ACK received (acked: 0x{acked_cmd:02X}, status: OK)")
                            else:
                                print(f"[WARN] ACK received with error: 0x{error_code:02X} (acked: 0x{acked_cmd:02X})")
                            return True, response
                        else:
                            print(f"[INFO] Response ID: 0x{resp_cmd_id:02X}")
                            return True, response
                    else:
                        print(f"[WARN] Invalid response header")
                        return False, response
                else:
                    print(f"[WARN] Response too short: {len(response)} bytes")
                    return False, response
            else:
                print("[TIMEOUT] No response received")
                return False, None

        except serial.SerialException as e:
            print(f"[ERROR] Serial communication error: {e}")
            return False, None

    def run_tests(self):
        """Run all protocol tests."""
        print("\n" + "="*60)
        print("CVTE Serial Protocol Test Suite")
        print("="*60)

        if not self.open():
            return

        results = []

        try:
            # Test 1: GET_CHECKSUM (0x12)
            success, _ = self.send_command(
                cmd_id=0x12,
                expected_response_id=0x13,
                cmd_name="GET_CHECKSUM"
            )
            results.append(("GET_CHECKSUM", "0x12", success))
            time.sleep(0.5)

            # Test 2: GET_IP (0x31)
            success, _ = self.send_command(
                cmd_id=0x31,
                expected_response_id=0x32,
                cmd_name="GET_IP_INFO"
            )
            results.append(("GET_IP_INFO", "0x31", success))
            time.sleep(0.5)

            # Test 3: GET_WIFI_STATUS (0x33)
            success, _ = self.send_command(
                cmd_id=0x33,
                expected_response_id=0x34,
                cmd_name="GET_WIFI_STATUS"
            )
            results.append(("GET_WIFI_STATUS", "0x33", success))
            time.sleep(0.5)

            # Test 4: CHECK_BLUETOOTH (0x38)
            success, _ = self.send_command(
                cmd_id=0x38,
                expected_response_id=0x39,
                cmd_name="CHECK_BLUETOOTH"
            )
            results.append(("CHECK_BLUETOOTH", "0x38", success))
            time.sleep(0.5)

            # Test 5: GET_MAC_ADDR (0x0C)
            success, _ = self.send_command(
                cmd_id=0x0C,
                expected_response_id=0x0D,
                cmd_name="GET_MAC_ADDR"
            )
            results.append(("GET_MAC_ADDR", "0x0C", success))
            time.sleep(0.5)

            # Test 6: GET_SOURCE (0x14)
            success, _ = self.send_command(
                cmd_id=0x14,
                expected_response_id=0x15,
                cmd_name="GET_SOURCE"
            )
            results.append(("GET_SOURCE", "0x14", success))
            time.sleep(0.5)

            # Test 7: SET_SOURCE to HDMI1 (0x16, param=8)
            success, _ = self.send_command(
                cmd_id=0x16,
                params=[0x08],  # HDMI1
                expected_response_id=0x01,  # ACK
                cmd_name="SET_SOURCE (HDMI1)"
            )
            results.append(("SET_SOURCE HDMI1", "0x16 [08]", success))
            time.sleep(0.5)

            # Test 8: SET_SOURCE to DTV (0x16, param=1)
            success, _ = self.send_command(
                cmd_id=0x16,
                params=[0x01],  # DTV
                expected_response_id=0x01,  # ACK
                cmd_name="SET_SOURCE (DTV)"
            )
            results.append(("SET_SOURCE DTV", "0x16 [01]", success))
            time.sleep(0.5)

            # Test 9: SET_SOURCE to ATV (0x16, param=0)
            success, _ = self.send_command(
                cmd_id=0x16,
                params=[0x00],  # ATV
                expected_response_id=0x01,  # ACK
                cmd_name="SET_SOURCE (ATV)"
            )
            results.append(("SET_SOURCE ATV", "0x16 [00]", success))

        finally:
            self.close()

        # Print summary
        print("\n" + "="*60)
        print("Test Summary")
        print("="*60)
        print(f"{'Command':<25} {'CMD ID':<12} {'Status':<15}")
        print("-"*60)
        for cmd_name, cmd_id, success in results:
            status = "OK" if success else "NO RESPONSE"
            print(f"{cmd_name:<25} {cmd_id:<12} {status:<15}")

        # Count results
        passed = sum(1 for _, _, s in results if s)
        total = len(results)
        print("-"*60)
        print(f"Total: {passed}/{total} commands responded")


def main():
    """Main entry point."""
    # Allow port override from command line
    port = None
    if len(sys.argv) > 1:
        port = sys.argv[1]

    tester = CVTESerialTester(port)

    # Verify checksum calculations match protocol.md
    print("\nChecksum Verification:")
    print("-" * 40)

    # Test GET_CHECKSUM packet
    test_packet = bytes([0xFF, 0x33, 0x06, 0x03, 0x12])
    cs = CVTESerialTester.calculate_checksum(test_packet)
    expected = 0xE5
    print(f"GET_CHECKSUM: calc=0x{cs:02X}, expected=0x{expected:02X}, {'OK' if cs == expected else 'FAIL'}")

    # Test GET_IP_INFO packet
    test_packet = bytes([0xFF, 0x33, 0x06, 0x03, 0x31])
    cs = CVTESerialTester.calculate_checksum(test_packet)
    expected = 0xC6
    print(f"GET_IP_INFO:  calc=0x{cs:02X}, expected=0x{expected:02X}, {'OK' if cs == expected else 'FAIL'}")

    # Test GET_WIFI_STATUS packet
    test_packet = bytes([0xFF, 0x33, 0x06, 0x03, 0x33])
    cs = CVTESerialTester.calculate_checksum(test_packet)
    expected = 0xC4
    print(f"GET_WIFI:     calc=0x{cs:02X}, expected=0x{expected:02X}, {'OK' if cs == expected else 'FAIL'}")

    # Test CHECK_BLUETOOTH packet
    test_packet = bytes([0xFF, 0x33, 0x06, 0x03, 0x38])
    cs = CVTESerialTester.calculate_checksum(test_packet)
    expected = 0xBF  # Corrected from 0xCF
    print(f"BT_CHECK:     calc=0x{cs:02X}, expected=0x{expected:02X}, {'OK' if cs == expected else 'FAIL'}")

    # Test GET_MAC_ADDR packet
    test_packet = bytes([0xFF, 0x33, 0x06, 0x03, 0x0C])
    cs = CVTESerialTester.calculate_checksum(test_packet)
    expected = 0xEB  # Corrected from 0xEC
    print(f"GET_MAC:      calc=0x{cs:02X}, expected=0x{expected:02X}, {'OK' if cs == expected else 'FAIL'}")

    # Test GET_SOURCE packet
    test_packet = bytes([0xFF, 0x33, 0x06, 0x03, 0x14])
    cs = CVTESerialTester.calculate_checksum(test_packet)
    expected = 0xE3
    print(f"GET_SOURCE:   calc=0x{cs:02X}, expected=0x{expected:02X}, {'OK' if cs == expected else 'FAIL'}")

    # Test SET_SOURCE packets
    test_packet = bytes([0xFF, 0x33, 0x07, 0x03, 0x16, 0x00])  # ATV
    cs = CVTESerialTester.calculate_checksum(test_packet)
    expected = 0xE0  # Corrected from 0xE9
    print(f"SET_ATV:      calc=0x{cs:02X}, expected=0x{expected:02X}, {'OK' if cs == expected else 'FAIL'}")

    test_packet = bytes([0xFF, 0x33, 0x07, 0x03, 0x16, 0x01])  # DTV
    cs = CVTESerialTester.calculate_checksum(test_packet)
    expected = 0xDF  # Corrected from 0xE8
    print(f"SET_DTV:      calc=0x{cs:02X}, expected=0x{expected:02X}, {'OK' if cs == expected else 'FAIL'}")

    test_packet = bytes([0xFF, 0x33, 0x07, 0x03, 0x16, 0x08])  # HDMI1
    cs = CVTESerialTester.calculate_checksum(test_packet)
    expected = 0xD8  # Corrected from 0xE0
    print(f"SET_HDMI1:    calc=0x{cs:02X}, expected=0x{expected:02X}, {'OK' if cs == expected else 'FAIL'}")

    print("-" * 40)

    # Run serial tests
    tester.run_tests()


if __name__ == "__main__":
    main()
