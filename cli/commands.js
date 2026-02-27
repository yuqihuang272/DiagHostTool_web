/**
 * CLI Command Handlers
 * Maps CLI commands to protocol builders and parsers
 */

import {
  CommandBuilder,
  PROTOCOL,
  SOURCE_IDS,
  parseChecksumResponse,
  parseIpResponse,
  parseMacResponse,
  parseSourceResponse,
  parseWifiResponse,
  parseBluetoothResponse,
  parseAckResponse,
} from '../shared/cvteProtocol.js';

import { SerialClient } from './serialClient.js';

/**
 * Command configuration map
 * Maps CLI commands to their builder and parser functions
 */
const COMMAND_MAP = {
  get: {
    checksum: {
      builder: CommandBuilder.getChecksum,
      parser: parseChecksumResponse,
      expectedCmdId: PROTOCOL.CMD.RET_CHECKSUM,
      label: 'Checksum',
      resultKey: 'checksum',
    },
    ip: {
      builder: CommandBuilder.getIp,
      parser: parseIpResponse,
      expectedCmdId: PROTOCOL.CMD.RET_IP_INFO,
      label: 'IP Address',
      resultKey: 'ip',
    },
    mac: {
      builder: CommandBuilder.getMacAddress,
      parser: parseMacResponse,
      expectedCmdId: PROTOCOL.CMD.RET_MAC_ADDR,
      label: 'MAC Address',
      resultKey: 'mac',
    },
    source: {
      builder: CommandBuilder.getSource,
      parser: parseSourceResponse,
      expectedCmdId: PROTOCOL.CMD.RET_SOURCE,
      label: 'Source',
      resultKey: 'source',
    },
    wifi: {
      builder: CommandBuilder.getWifiStatus,
      parser: parseWifiResponse,
      expectedCmdId: PROTOCOL.CMD.RET_WIFI_STATUS,
      label: 'WiFi Status',
      resultKey: 'status',
    },
    bluetooth: {
      builder: CommandBuilder.getBluetoothStatus,
      parser: parseBluetoothResponse,
      expectedCmdId: PROTOCOL.CMD.RET_BLUETOOTH_STATUS,
      label: 'Bluetooth Status',
      resultKey: 'status',
    },
  },
  set: {
    source: {
      builder: (value) => {
        const sourceId = SOURCE_IDS[value.toLowerCase()];
        if (sourceId === undefined) {
          throw new Error(`Invalid source: ${value}. Valid sources: ${Object.keys(SOURCE_IDS).join(', ')}`);
        }
        return CommandBuilder.setSource(sourceId);
      },
      parser: (data) => parseAckResponse(data, PROTOCOL.CMD.SET_SOURCE),
      expectedCmdId: null, // ACK response
      label: 'Source',
      isSetCommand: true,
    },
  },
  test: {
    wifi: {
      builder: CommandBuilder.getWifiStatus,
      parser: parseWifiResponse,
      expectedCmdId: PROTOCOL.CMD.RET_WIFI_STATUS,
      label: 'WiFi Test',
      resultKey: 'status',
    },
    bluetooth: {
      builder: CommandBuilder.getBluetoothStatus,
      parser: parseBluetoothResponse,
      expectedCmdId: PROTOCOL.CMD.RET_BLUETOOTH_STATUS,
      label: 'Bluetooth Test',
      resultKey: 'status',
    },
  },
};

/**
 * Get command configuration
 * @param {string} category - Command category (get, set, test)
 * @param {string} action - Command action
 * @returns {object|null} Command configuration
 */
export function getCommandConfig(category, action) {
  return COMMAND_MAP[category]?.[action] || null;
}

/**
 * Get all available commands
 * @returns {object} Available commands grouped by category
 */
export function getAvailableCommands() {
  const commands = {};
  for (const [category, actions] of Object.entries(COMMAND_MAP)) {
    commands[category] = Object.keys(actions);
  }
  return commands;
}

/**
 * Execute a command on the device
 * @param {string} portPath - Serial port path
 * @param {number} baudRate - Baud rate
 * @param {string} category - Command category (get, set, test)
 * @param {string} action - Command action
 * @param {string} [value] - Optional value for set commands
 * @param {number} [timeout] - Response timeout
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function executeCommand(portPath, baudRate, category, action, value = null, timeout = 3000) {
  const config = getCommandConfig(category, action);
  if (!config) {
    return { success: false, error: `Unknown command: ${category} ${action}` };
  }

  const client = new SerialClient(portPath, baudRate);

  try {
    await client.connect();

    // Build command
    const hexCommand = value ? config.builder(value) : config.builder();

    // Send command and get response
    const response = await client.sendCommand(hexCommand, timeout);

    // Parse response
    const result = config.parser(response);

    return {
      success: result.success,
      data: result,
      error: result.error,
    };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    await client.disconnect();
  }
}

/**
 * Format result for display
 * @param {object} result - Parsed result
 * @param {object} config - Command configuration
 * @returns {string} Formatted output
 */
export function formatResult(result, config) {
  if (config.isSetCommand) {
    return result.success ? 'OK' : `Error: ${result.error}`;
  }

  if (!result.success) {
    return `Error: ${result.error}`;
  }

  const value = result[config.resultKey];
  return `${config.label}: ${value}`;
}

/**
 * Format result as JSON
 * @param {object} result - Execution result
 * @returns {string} JSON string
 */
export function formatResultJson(result) {
  if (result.success) {
    return JSON.stringify({
      success: true,
      ...result.data,
    }, null, 2);
  }
  return JSON.stringify({
    success: false,
    error: result.error,
  }, null, 2);
}
