/**
 * CVTE Protocol Response Parsers
 *
 * These parsers convert raw protocol responses to human-readable strings.
 */

import {
  extractAsciiString,
  formatMacAddress,
  formatHexPayload,
  PROTOCOL,
  SOURCE_NAMES,
  STATUS_NAMES,
} from './cvteProtocol';

/**
 * Simple response parser - extracts payload without strict validation
 *
 * @param {ArrayBuffer} data - Raw response data
 * @returns {{bytes: Uint8Array, responseCmdId: number, payload: Uint8Array}}
 */
const parseBasicResponse = (data) => {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data);
  const responseCmdId = bytes.length > 4 ? bytes[4] : 0;
  const payload = bytes.length > 5 ? bytes.slice(5, bytes.length - 1) : new Uint8Array(0);
  return { bytes, responseCmdId, payload };
};

/**
 * Base parser result structure
 * @typedef {Object} ParseResult
 * @property {boolean} success - Whether parsing was successful
 * @property {string} display - Human-readable display string
 * @property {string} [error] - Error message if parsing failed
 * @property {object} [raw] - Raw parsed data for debugging
 */

/**
 * Parse Checksum response (0x13)
 *
 * @param {ArrayBuffer} data - Raw response data
 * @returns {ParseResult}
 */
export const parseChecksumResponse = (data) => {
  const { bytes, responseCmdId, payload } = parseBasicResponse(data);

  // Check if it's an ACK response
  if (responseCmdId === PROTOCOL.CMD.ACK) {
    return parseAckResponse(data);
  }

  // Check response ID
  if (responseCmdId !== PROTOCOL.CMD.RET_CHECKSUM) {
    return { success: false, display: `Unexpected response ID: 0x${responseCmdId.toString(16)}` };
  }

  const checksumStr = extractAsciiString(payload);
  return {
    success: true,
    display: `Checksum: ${checksumStr}`,
    raw: { checksum: checksumStr },
  };
};

/**
 * Parse IP Address response (0x32)
 *
 * @param {ArrayBuffer} data - Raw response data
 * @returns {ParseResult}
 */
export const parseIpResponse = (data) => {
  const { bytes, responseCmdId, payload } = parseBasicResponse(data);

  // Check if it's an ACK response
  if (responseCmdId === PROTOCOL.CMD.ACK) {
    return parseAckResponse(data);
  }

  // Check response ID
  if (responseCmdId !== PROTOCOL.CMD.RET_IP_INFO) {
    return { success: false, display: `Unexpected response ID: 0x${responseCmdId.toString(16)}` };
  }

  const ipStr = extractAsciiString(payload);
  return {
    success: true,
    display: `IP: ${ipStr}`,
    raw: { ip: ipStr },
  };
};

/**
 * Parse WiFi Status response (0x34)
 *
 * @param {ArrayBuffer} data - Raw response data
 * @returns {ParseResult}
 */
export const parseWifiResponse = (data) => {
  const { bytes, responseCmdId, payload } = parseBasicResponse(data);

  // Check if it's an ACK response
  if (responseCmdId === PROTOCOL.CMD.ACK) {
    return parseAckResponse(data);
  }

  // Check response ID
  if (responseCmdId !== PROTOCOL.CMD.RET_WIFI_STATUS) {
    return { success: false, display: `Unexpected response ID: 0x${responseCmdId.toString(16)}` };
  }

  const statusCode = payload[0];
  const statusName = STATUS_NAMES[statusCode] || `Unknown (${statusCode})`;

  // Add emoji for visual feedback
  const statusEmoji = statusCode === 0 ? '✓' : statusCode === 1 ? '⏳' : '✗';

  return {
    success: statusCode === 0,
    display: `WiFi: ${statusEmoji} ${statusName}`,
    raw: { statusCode, statusName },
  };
};

/**
 * Parse Bluetooth Status response (0x39)
 *
 * @param {ArrayBuffer} data - Raw response data
 * @returns {ParseResult}
 */
export const parseBluetoothResponse = (data) => {
  const { bytes, responseCmdId, payload } = parseBasicResponse(data);

  // Check if it's an ACK response
  if (responseCmdId === PROTOCOL.CMD.ACK) {
    return parseAckResponse(data);
  }

  // Check response ID
  if (responseCmdId !== PROTOCOL.CMD.RET_BLUETOOTH_STATUS) {
    // Show raw hex for debugging
    return {
      success: false,
      display: `Unexpected response (expected 0x39, got 0x${responseCmdId.toString(16)}): ${formatHexPayload(bytes)}`,
    };
  }

  const statusCode = payload[0];
  const statusName = STATUS_NAMES[statusCode] || `Unknown (${statusCode})`;

  // Add emoji for visual feedback
  const statusEmoji = statusCode === 0 ? '✓' : statusCode === 1 ? '⏳' : '✗';

  return {
    success: statusCode === 0,
    display: `Bluetooth: ${statusEmoji} ${statusName}`,
    raw: { statusCode, statusName },
  };
};

/**
 * Parse MAC Address response (0x0D)
 *
 * @param {ArrayBuffer} data - Raw response data
 * @returns {ParseResult}
 */
export const parseMacResponse = (data) => {
  const { bytes, responseCmdId, payload } = parseBasicResponse(data);

  // Check if it's an ACK response
  if (responseCmdId === PROTOCOL.CMD.ACK) {
    return parseAckResponse(data);
  }

  // Check response ID
  if (responseCmdId !== PROTOCOL.CMD.RET_MAC_ADDR) {
    // Show raw hex for debugging
    return {
      success: false,
      display: `Unexpected response (expected 0x0D, got 0x${responseCmdId.toString(16)}): ${formatHexPayload(bytes)}`,
    };
  }

  if (payload.length !== 6) {
    return { success: false, display: `Error: Invalid MAC length (${payload.length} bytes)` };
  }

  const macStr = formatMacAddress(payload);
  return {
    success: true,
    display: `MAC: ${macStr}`,
    raw: { mac: macStr, bytes: Array.from(payload) },
  };
};

/**
 * Parse Source response (0x15)
 *
 * @param {ArrayBuffer} data - Raw response data
 * @returns {ParseResult}
 */
export const parseSourceResponse = (data) => {
  const { bytes, responseCmdId, payload } = parseBasicResponse(data);

  // Check if it's an ACK response
  if (responseCmdId === PROTOCOL.CMD.ACK) {
    return parseAckResponse(data);
  }

  // Check response ID
  if (responseCmdId !== PROTOCOL.CMD.RET_SOURCE) {
    return { success: false, display: `Unexpected response ID: 0x${responseCmdId.toString(16)}` };
  }

  const sourceId = payload[0];
  const sourceName = SOURCE_NAMES[sourceId] || `Unknown (${sourceId})`;

  return {
    success: true,
    display: `Current Source: ${sourceName}`,
    raw: { sourceId, sourceName },
  };
};

/**
 * Parse ACK response (0x01)
 *
 * @param {ArrayBuffer} data - Raw response data
 * @returns {ParseResult}
 */
export const parseAckResponse = (data) => {
  const bytes = new Uint8Array(data);

  if (bytes.length < 7) {
    return { success: false, display: 'Invalid ACK response' };
  }

  const errorCode = bytes[5];
  const cmdId = bytes[6];

  if (errorCode === 0) {
    return {
      success: true,
      display: `✓ ACK OK (CMD: 0x${cmdId.toString(16).toUpperCase()})`,
      raw: { errorCode, cmdId },
    };
  } else {
    const errorName = errorCode === 1 ? 'Unknown Command' : 'Parameter Error';
    return {
      success: false,
      display: `✗ ACK Error: ${errorName} (CMD: 0x${cmdId.toString(16).toUpperCase()})`,
      raw: { errorCode, cmdId },
    };
  }
};

/**
 * Parse Set Source response (expects ACK)
 *
 * @param {ArrayBuffer} data - Raw response data
 * @param {string} targetSource - Target source name for display
 * @returns {ParseResult}
 */
export const parseSetSourceResponse = (data, targetSource = 'Source') => {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data);

  if (bytes.length < 7) {
    return { success: false, display: `Response too short: ${formatHexPayload(bytes)}` };
  }

  // ACK response format: FF 33 0C 03 01 [error] [cmdId] ...
  // Check if byte[4] is 0x01 (ACK)
  if (bytes[4] === 0x01) {
    const errorCode = bytes[5];
    const ackedCmdId = bytes[6];

    if (errorCode === 0) {
      return {
        success: true,
        display: `✓ Switched to ${targetSource}`,
        raw: { targetSource, ackedCmdId },
      };
    } else {
      const errorName = errorCode === 1 ? 'Unknown Command' : 'Parameter Error';
      return {
        success: false,
        display: `✗ Failed: ${errorName}`,
        raw: { errorCode, ackedCmdId },
      };
    }
  }

  // Not an ACK, show raw response with hex
  return { success: true, display: `Response: ${formatHexPayload(bytes)}` };
};

/**
 * Generic response parser that attempts to identify the response type
 *
 * @param {ArrayBuffer} data - Raw response data
 * @returns {ParseResult}
 */
export const parseGenericResponse = (data) => {
  const { bytes, responseCmdId, payload } = parseBasicResponse(data);

  if (bytes.length < 6) {
    return { success: false, display: `Invalid response (too short): ${formatHexPayload(bytes)}` };
  }

  // Check frame header
  if (bytes[0] !== 0xFF || bytes[1] !== 0x33) {
    return { success: false, display: `Invalid frame header: ${formatHexPayload(bytes)}` };
  }

  // Try to identify by response command ID
  switch (responseCmdId) {
    case PROTOCOL.CMD.RET_CHECKSUM:
      return parseChecksumResponse(data);
    case PROTOCOL.CMD.RET_IP_INFO:
      return parseIpResponse(data);
    case PROTOCOL.CMD.RET_WIFI_STATUS:
      return parseWifiResponse(data);
    case PROTOCOL.CMD.RET_BLUETOOTH_STATUS:
      return parseBluetoothResponse(data);
    case PROTOCOL.CMD.RET_MAC_ADDR:
      return parseMacResponse(data);
    case PROTOCOL.CMD.RET_SOURCE:
      return parseSourceResponse(data);
    case PROTOCOL.CMD.ACK:
      return parseAckResponse(data);
    default:
      // Unknown response, show raw hex
      return {
        success: true,
        display: `Unknown response (0x${responseCmdId.toString(16)}): ${formatHexPayload(bytes)}`,
        raw: { responseCmdId, raw: formatHexPayload(bytes) },
      };
  }
};

// Export all parsers for easy access
export const PARSERS = {
  checksum: parseChecksumResponse,
  ip: parseIpResponse,
  wifi: parseWifiResponse,
  bluetooth: parseBluetoothResponse,
  mac: parseMacResponse,
  source: parseSourceResponse,
  ack: parseAckResponse,
  setSource: parseSetSourceResponse,
  generic: parseGenericResponse,
};
