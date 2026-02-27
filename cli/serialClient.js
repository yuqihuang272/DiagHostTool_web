/**
 * Serial Port Client for CLI
 * Provides promise-based serial port communication
 */

import { SerialPort } from 'serialport';

export class SerialClient {
  constructor(portPath, baudRate = 115200) {
    this.portPath = portPath;
    this.baudRate = baudRate;
    this.port = null;
    this.buffer = Buffer.alloc(0);
  }

  /**
   * Connect to serial port
   * @returns {Promise<void>}
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.port = new SerialPort({
        path: this.portPath,
        baudRate: this.baudRate,
        autoOpen: false,
      });

      this.port.open((err) => {
        if (err) {
          reject(new Error(`Failed to open port ${this.portPath}: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Send command and wait for response
   * @param {string} hexCommand - HEX command string (e.g., "FF 33 06 03 12 E5")
   * @param {number} timeout - Response timeout in milliseconds
   * @returns {Promise<Buffer>} Response data
   */
  async sendCommand(hexCommand, timeout = 3000) {
    return new Promise((resolve, reject) => {
      if (!this.port || !this.port.isOpen) {
        reject(new Error('Port is not open'));
        return;
      }

      // Parse hex command string to buffer
      const hexBytes = hexCommand.replace(/\s+/g, '');
      const buffer = Buffer.from(hexBytes, 'hex');

      // Set timeout
      const timer = setTimeout(() => {
        reject(new Error(`Response timeout (${timeout}ms)`));
      }, timeout);

      // Clear previous buffer
      this.buffer = Buffer.alloc(0);

      // Listen for response
      const onData = (data) => {
        this.buffer = Buffer.concat([this.buffer, data]);

        // Check if we have a complete packet
        // Minimum packet length is 6, and byte[2] tells us the total length
        if (this.buffer.length >= 6) {
          const packetLength = this.buffer[2];
          if (this.buffer.length >= packetLength) {
            clearTimeout(timer);
            this.port.off('data', onData);
            // Return only the complete packet
            resolve(this.buffer.slice(0, packetLength));
          }
        }
      };

      this.port.on('data', onData);

      // Send command
      this.port.write(buffer, (err) => {
        if (err) {
          clearTimeout(timer);
          this.port.off('data', onData);
          reject(new Error(`Failed to send command: ${err.message}`));
        }
      });
    });
  }

  /**
   * Disconnect from serial port
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.port && this.port.isOpen) {
      return new Promise((resolve, reject) => {
        this.port.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  }

  /**
   * Check if port is open
   * @returns {boolean}
   */
  isOpen() {
    return this.port && this.port.isOpen;
  }

  /**
   * List available serial ports
   * @returns {Promise<Array<{path: string, manufacturer?: string, serialNumber?: string}>>}
   */
  static async listPorts() {
    return SerialPort.list();
  }
}
