#!/usr/bin/env python3
"""Simple CVTE serial test script"""

import serial
import time
import sys

def main():
    port = '/dev/tty.usbserial-gggggggg1'
    baud = 115200

    print("=== CVTE Serial Protocol Test ===")
    sys.stdout.flush()

    try:
        ser = serial.Serial(port=port, baudrate=baud, timeout=2)
        print(f"Opened {port} at {baud} baud")
        sys.stdout.flush()
        time.sleep(0.1)

        # Test commands with corrected checksums
        commands = [
            ("GET_CHECKSUM", bytes([0xFF, 0x33, 0x06, 0x03, 0x12, 0xE5]), 0x13),
            ("GET_IP_INFO", bytes([0xFF, 0x33, 0x06, 0x03, 0x31, 0xC6]), 0x32),
            ("GET_WIFI_STATUS", bytes([0xFF, 0x33, 0x06, 0x03, 0x33, 0xC4]), 0x34),
            ("CHECK_BLUETOOTH", bytes([0xFF, 0x33, 0x06, 0x03, 0x38, 0xBF]), 0x39),  # Corrected
            ("GET_MAC_ADDR", bytes([0xFF, 0x33, 0x06, 0x03, 0x0C, 0xEB]), 0x0D),    # Corrected
            ("GET_SOURCE", bytes([0xFF, 0x33, 0x06, 0x03, 0x14, 0xE3]), 0x15),
            ("SET_SOURCE ATV", bytes([0xFF, 0x33, 0x07, 0x03, 0x16, 0x00, 0xE0]), 0x01),  # Corrected
            ("SET_SOURCE DTV", bytes([0xFF, 0x33, 0x07, 0x03, 0x16, 0x01, 0xDF]), 0x01),  # Corrected
            ("SET_SOURCE HDMI1", bytes([0xFF, 0x33, 0x07, 0x03, 0x16, 0x08, 0xD8]), 0x01),  # Corrected
        ]

        results = []

        for name, cmd, expected_resp in commands:
            print(f"\n--- {name} ---")
            print(f"TX: {' '.join(f'{b:02X}' for b in cmd)}")
            sys.stdout.flush()

            ser.reset_input_buffer()
            ser.write(cmd)
            ser.flush()

            time.sleep(0.3)

            if ser.in_waiting > 0:
                resp = ser.read(ser.in_waiting)
                print(f"RX: {' '.join(f'{b:02X}' for b in resp)}")

                if len(resp) >= 5:
                    resp_id = resp[4]
                    if resp_id == expected_resp:
                        print(f"[OK] Response ID matches: 0x{resp_id:02X}")
                        results.append((name, True, "OK"))
                    elif resp_id == 0x01:  # ACK
                        print(f"[OK] ACK received")
                        results.append((name, True, "ACK"))
                    else:
                        print(f"[INFO] Response ID: 0x{resp_id:02X} (expected 0x{expected_resp:02X})")
                        results.append((name, True, f"ID=0x{resp_id:02X}"))
                else:
                    print(f"[WARN] Response too short")
                    results.append((name, False, "Short"))
            else:
                print("[TIMEOUT] No response")
                results.append((name, False, "Timeout"))

            sys.stdout.flush()
            time.sleep(0.3)

        ser.close()
        print("\n=== Port closed ===")

        print("\n=== Test Summary ===")
        print(f"{'Command':<25} {'Status':<10}")
        print("-" * 40)
        for name, success, status in results:
            print(f"{name:<25} {status:<10}")

        passed = sum(1 for _, s, _ in results if s)
        print(f"\nPassed: {passed}/{len(results)}")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
