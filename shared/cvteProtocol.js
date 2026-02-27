/**
 * CVTE Factory Auto Test Serial Protocol Utilities
 * Shared module for both WebUI and CLI
 *
 * Protocol Format:
 * [0x00] 0xFF - Sync byte
 * [0x01] 0x33 - Start byte
 * [0x02] 0xNN - Packet length (>= 6)
 * [0x03] 0x03 - Protocol type (Factory Auto Test)
 * [0x04] CMD  - Command ID
 * [0x05..NN-2] - Payload data
 * [0xNN-1] - Checksum
 */

// Protocol constants
export const PROTOCOL = {
  SYNC_BYTE: 0xFF,
  START_BYTE: 0x33,
  PROTOCOL_TYPE: 0x03,  // Factory Auto Test

  // Command IDs
  CMD: {
    GET_MAC_ADDR: 0x0C,
    RET_MAC_ADDR: 0x0D,
    GET_CHECKSUM: 0x12,
    RET_CHECKSUM: 0x13,
    GET_SOURCE: 0x14,
    RET_SOURCE: 0x15,
    SET_SOURCE: 0x16,
    GET_IP_INFO: 0x31,
    RET_IP_INFO: 0x32,
    GET_WIFI_STATUS: 0x33,
    RET_WIFI_STATUS: 0x34,
    CHECK_BLUETOOTH: 0x38,
    RET_BLUETOOTH_STATUS: 0x39,
    ACK: 0x01,
  },

  // Source IDs for SET_SOURCE command
  SOURCE: {
    ATV: 0x00,
    DTV: 0x01,
    DVBS: 2,
    DVBC: 3,
    DVBT: 4,
    DVBT2: 5,
    VGA: 6,
    HDMI1: 8,
    HDMI2: 9,
    HDMI3: 10,
    HDMI4: 11,
    HDMI5: 12,
    AV1: 15,
    AV2: 16,
    USB1: 23,
    USB2: 24,
  },

  // Status codes for WiFi/Bluetooth
  STATUS: {
    OK: 0,
    CHECKING: 1,
    FAILED: 2,
  },
};

// Source ID to name mapping
export const SOURCE_NAMES = {
  0x00: 'ATV',
  0x01: 'DTV',
  2: 'DVBS',
  3: 'DVBC',
  4: 'DVBT',
  5: 'DVBT2',
  6: 'VGA',
  7: 'VGA2',
  8: 'HDMI1',
  9: 'HDMI2',
  10: 'HDMI3',
  11: 'HDMI4',
  12: 'HDMI5',
  13: 'SCART1',
  14: 'SCART2',
  15: 'AV1',
  16: 'AV2',
  17: 'AV3',
  18: 'AV4',
  19: 'YPBPR1',
  20: 'YPBPR2',
  21: 'YPBPR3',
  22: 'YPBPR4',
  23: 'USB1',
  24: 'USB2',
  25: 'USB3',
  26: 'USB4',
};

// Source name to ID mapping (for CLI)
export const SOURCE_IDS = {
  'atv': PROTOCOL.SOURCE.ATV,
  'dtv': PROTOCOL.SOURCE.DTV,
  'dvbs': PROTOCOL.SOURCE.DVBS,
  'dvbc': PROTOCOL.SOURCE.DVBC,
  'dvbt': PROTOCOL.SOURCE.DVBT,
  'dvbt2': PROTOCOL.SOURCE.DVBT2,
  'vga': PROTOCOL.SOURCE.VGA,
  'hdmi1': PROTOCOL.SOURCE.HDMI1,
  'hdmi2': PROTOCOL.SOURCE.HDMI2,
  'hdmi3': PROTOCOL.SOURCE.HDMI3,
  'hdmi4': PROTOCOL.SOURCE.HDMI4,
  'hdmi5': PROTOCOL.SOURCE.HDMI5,
  'av1': PROTOCOL.SOURCE.AV1,
  'av2': PROTOCOL.SOURCE.AV2,
  'usb1': PROTOCOL.SOURCE.USB1,
  'usb2': PROTOCOL.SOURCE.USB2,
};

// Status code to name mapping
export const STATUS_NAMES = {
  0: 'Normal',
  1: 'Checking...',
  2: 'Failed',
};

/**
 * Calculate checksum for CVTE protocol
 * Checksum = 0x100 - (sum of all bytes in data)
 *
 * @param {Uint8Array|number[]} data - Packet bytes from index 2 (without sync, start, and checksum)
 * @returns {number} Checksum byte
 */
export const calculateChecksum = (data) => {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let sum = 0;
  // Sum ALL bytes in the data array
  for (let i = 0; i < bytes.length; i++) {
    sum += bytes[i];
  }
  return (0x100 - (sum & 0xFF)) & 0xFF;
};

/**
 * Build a complete CVTE protocol command packet
 *
 * @param {number} cmdId - Command ID
 * @param {number[]} payload - Optional payload bytes
 * @returns {number[]} Complete packet bytes
 */
export const buildCommand = (cmdId, payload = []) => {
  // Packet: [FF] [33] [LEN] [03] [CMD] [...payload] [CHECKSUM]
  const packetLength = 6 + payload.length;  // Header(2) + Len(1) + Type(1) + Cmd(1) + Payload + Checksum(1)
  const packet = [
    PROTOCOL.SYNC_BYTE,
    PROTOCOL.START_BYTE,
    packetLength,
    PROTOCOL.PROTOCOL_TYPE,
    cmdId,
    ...payload,
  ];
  // Calculate and append checksum
  const checksum = calculateChecksum(packet.slice(2));
  packet.push(checksum);
  return packet;
};

/**
 * Convert packet bytes to HEX string
 *
 * @param {number[]} packet - Packet bytes
 * @returns {string} HEX string (e.g., "FF 33 06 03 12 E5")
 */
export const packetToHex = (packet) => {
  return packet.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
};

/**
 * Parse HEX string to packet bytes
 *
 * @param {string} hexStr - HEX string (e.g., "FF 33 06 03 12 E5")
 * @returns {number[]} Packet bytes
 */
export const hexToPacket = (hexStr) => {
  const cleanHex = hexStr.replace(/\s+/g, '');
  const bytes = [];
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes.push(parseInt(cleanHex.substr(i, 2), 16));
  }
  return bytes;
};

/**
 * Validate CVTE protocol response
 *
 * @param {ArrayBuffer|Uint8Array|Buffer} data - Raw response data
 * @param {number} expectedCmdId - Expected response command ID
 * @returns {{valid: boolean, error?: string, packet?: object}}
 */
export const validateResponse = (data, expectedCmdId = null) => {
  // Handle Node.js Buffer and browser types
  let bytes;
  if (Buffer.isBuffer(data)) {
    bytes = new Uint8Array(data);
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else {
    bytes = new Uint8Array(data);
  }

  // Check minimum length
  if (bytes.length < 6) {
    return { valid: false, error: 'Response too short' };
  }

  // Check sync byte
  if (bytes[0] !== PROTOCOL.SYNC_BYTE) {
    return { valid: false, error: `Invalid sync byte: 0x${bytes[0].toString(16)}` };
  }

  // Check start byte
  if (bytes[1] !== PROTOCOL.START_BYTE) {
    return { valid: false, error: `Invalid start byte: 0x${bytes[1].toString(16)}` };
  }

  // Check packet length
  const packetLength = bytes[2];
  if (bytes.length !== packetLength) {
    return { valid: false, error: `Length mismatch: expected ${packetLength}, got ${bytes.length}` };
  }

  // Verify checksum
  const receivedChecksum = bytes[bytes.length - 1];
  const calculatedChecksum = calculateChecksum(bytes.slice(2, -1));
  if (receivedChecksum !== calculatedChecksum) {
    return { valid: false, error: `Checksum mismatch: expected 0x${calculatedChecksum.toString(16)}, got 0x${receivedChecksum.toString(16)}` };
  }

  // Check protocol type
  if (bytes[3] !== PROTOCOL.PROTOCOL_TYPE) {
    return { valid: false, error: `Invalid protocol type: 0x${bytes[3].toString(16)}` };
  }

  // Extract response command ID
  const responseCmdId = bytes[4];

  // Check if it's an ACK response
  const isAck = responseCmdId === PROTOCOL.CMD.ACK;

  // Validate expected command ID (if provided and not ACK)
  if (expectedCmdId !== null && !isAck && responseCmdId !== expectedCmdId) {
    return { valid: false, error: `Unexpected response ID: expected 0x${expectedCmdId.toString(16)}, got 0x${responseCmdId.toString(16)}` };
  }

  // Extract payload (bytes after command ID, before checksum)
  const payload = bytes.slice(5, bytes.length - 1);

  return {
    valid: true,
    packetLength,
    protocolType: bytes[3],
    responseCmdId,
    isAck,
    payload,
    ackCmdId: isAck ? bytes[6] : null,  // For ACK responses, byte 6 is the acknowledged command ID
    ackError: isAck ? bytes[5] : null,  // For ACK responses, byte 5 is the error code
  };
};

/**
 * Extract ASCII string from payload
 *
 * @param {Uint8Array} payload - Payload bytes
 * @returns {string} ASCII string
 */
export const extractAsciiString = (payload) => {
  return String.fromCharCode(...payload);
};

/**
 * Format MAC address bytes to human-readable format
 *
 * @param {Uint8Array} macBytes - 6 MAC address bytes
 * @returns {string} Formatted MAC (e.g., "AA:BB:CC:DD:EE:FF")
 */
export const formatMacAddress = (macBytes) => {
  return Array.from(macBytes)
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(':');
};

/**
 * Format payload as HEX string
 *
 * @param {Uint8Array} payload - Payload bytes
 * @returns {string} HEX string
 */
export const formatHexPayload = (payload) => {
  return Array.from(payload)
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
};

/**
 * Build command HEX string dynamically
 *
 * @param {number} cmdId - Command ID
 * @param {number[]} payload - Optional payload bytes
 * @returns {string} HEX command string
 */
export const buildCommandHex = (cmdId, payload = []) => {
  const packet = buildCommand(cmdId, payload);
  return packetToHex(packet);
};

/**
 * Build SET_SOURCE command for a specific source
 *
 * @param {number} sourceId - Source ID (see SOURCE constants)
 * @returns {string} HEX command string
 */
export const buildSetSourceCommand = (sourceId) => {
  return buildCommandHex(PROTOCOL.CMD.SET_SOURCE, [sourceId]);
};

/**
 * Command generators - use these instead of hardcoded strings
 * Each function returns a HEX command string with dynamically calculated checksum
 */
export const CommandBuilder = {
  // Query commands (no payload)
  getChecksum: () => buildCommandHex(PROTOCOL.CMD.GET_CHECKSUM),
  getIp: () => buildCommandHex(PROTOCOL.CMD.GET_IP_INFO),
  getWifiStatus: () => buildCommandHex(PROTOCOL.CMD.GET_WIFI_STATUS),
  getBluetoothStatus: () => buildCommandHex(PROTOCOL.CMD.CHECK_BLUETOOTH),
  getMacAddress: () => buildCommandHex(PROTOCOL.CMD.GET_MAC_ADDR),
  getSource: () => buildCommandHex(PROTOCOL.CMD.GET_SOURCE),

  // Set commands (with payload)
  setSource: (sourceId) => buildSetSourceCommand(sourceId),
  setAtv: () => buildSetSourceCommand(PROTOCOL.SOURCE.ATV),
  setDtv: () => buildSetSourceCommand(PROTOCOL.SOURCE.DTV),
  setHdmi1: () => buildSetSourceCommand(PROTOCOL.SOURCE.HDMI1),
  setHdmi2: () => buildSetSourceCommand(PROTOCOL.SOURCE.HDMI2),
};

/**
 * Pre-built command HEX strings (DEPRECATED - use CommandBuilder instead)
 * These are kept for backward compatibility but checksum is calculated dynamically.
 */
export const COMMANDS = {
  get GET_CHECKSUM() { return CommandBuilder.getChecksum(); },
  get GET_IP() { return CommandBuilder.getIp(); },
  get GET_WIFI_STATUS() { return CommandBuilder.getWifiStatus(); },
  get GET_BLUETOOTH_STATUS() { return CommandBuilder.getBluetoothStatus(); },
  get GET_MAC_ADDR() { return CommandBuilder.getMacAddress(); },
  get GET_SOURCE() { return CommandBuilder.getSource(); },
  get SET_ATV() { return CommandBuilder.setAtv(); },
  get SET_DTV() { return CommandBuilder.setDtv(); },
  get SET_HDMI1() { return CommandBuilder.setHdmi1(); },
  get SET_HDMI2() { return CommandBuilder.setHdmi2(); },
};

// ============================================================
// Response Parsers - Parse device responses
// ============================================================

/**
 * Parse checksum response
 * @param {Buffer|Uint8Array} data - Raw response data
 * @returns {{success: boolean, checksum?: string, error?: string}}
 */
export const parseChecksumResponse = (data) => {
  const validation = validateResponse(data, PROTOCOL.CMD.RET_CHECKSUM);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  if (validation.isAck && validation.ackError !== 0) {
    return { success: false, error: `Device returned error code: ${validation.ackError}` };
  }
  const checksum = extractAsciiString(validation.payload);
  return { success: true, checksum };
};

/**
 * Parse IP address response
 * @param {Buffer|Uint8Array} data - Raw response data
 * @returns {{success: boolean, ip?: string, error?: string}}
 */
export const parseIpResponse = (data) => {
  const validation = validateResponse(data, PROTOCOL.CMD.RET_IP_INFO);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  if (validation.isAck && validation.ackError !== 0) {
    return { success: false, error: `Device returned error code: ${validation.ackError}` };
  }
  const ip = extractAsciiString(validation.payload);
  return { success: true, ip };
};

/**
 * Parse MAC address response
 * @param {Buffer|Uint8Array} data - Raw response data
 * @returns {{success: boolean, mac?: string, error?: string}}
 */
export const parseMacResponse = (data) => {
  const validation = validateResponse(data, PROTOCOL.CMD.RET_MAC_ADDR);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  if (validation.isAck && validation.ackError !== 0) {
    return { success: false, error: `Device returned error code: ${validation.ackError}` };
  }
  const mac = formatMacAddress(validation.payload);
  return { success: true, mac };
};

/**
 * Parse source response
 * @param {Buffer|Uint8Array} data - Raw response data
 * @returns {{success: boolean, source?: string, sourceId?: number, error?: string}}
 */
export const parseSourceResponse = (data) => {
  const validation = validateResponse(data, PROTOCOL.CMD.RET_SOURCE);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  if (validation.isAck && validation.ackError !== 0) {
    return { success: false, error: `Device returned error code: ${validation.ackError}` };
  }
  const sourceId = validation.payload[0];
  const source = SOURCE_NAMES[sourceId] || `Unknown(0x${sourceId.toString(16)})`;
  return { success: true, source, sourceId };
};

/**
 * Parse WiFi status response
 * @param {Buffer|Uint8Array} data - Raw response data
 * @returns {{success: boolean, status?: string, statusCode?: number, error?: string}}
 */
export const parseWifiResponse = (data) => {
  const validation = validateResponse(data, PROTOCOL.CMD.RET_WIFI_STATUS);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  if (validation.isAck && validation.ackError !== 0) {
    return { success: false, error: `Device returned error code: ${validation.ackError}` };
  }
  const statusCode = validation.payload[0];
  const status = STATUS_NAMES[statusCode] || `Unknown(${statusCode})`;
  return { success: true, status, statusCode };
};

/**
 * Parse Bluetooth status response
 * @param {Buffer|Uint8Array} data - Raw response data
 * @returns {{success: boolean, status?: string, statusCode?: number, error?: string}}
 */
export const parseBluetoothResponse = (data) => {
  const validation = validateResponse(data, PROTOCOL.CMD.RET_BLUETOOTH_STATUS);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  if (validation.isAck && validation.ackError !== 0) {
    return { success: false, error: `Device returned error code: ${validation.ackError}` };
  }
  const statusCode = validation.payload[0];
  const status = STATUS_NAMES[statusCode] || `Unknown(${statusCode})`;
  return { success: true, status, statusCode };
};

/**
 * Parse ACK response (for set commands)
 * @param {Buffer|Uint8Array} data - Raw response data
 * @param {number} expectedCmdId - Expected acknowledged command ID
 * @returns {{success: boolean, error?: string}}
 */
export const parseAckResponse = (data, expectedCmdId = null) => {
  const validation = validateResponse(data, null);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  if (!validation.isAck) {
    return { success: false, error: 'Expected ACK response' };
  }
  if (expectedCmdId !== null && validation.ackCmdId !== expectedCmdId) {
    return { success: false, error: `Unexpected ACK command: expected 0x${expectedCmdId.toString(16)}, got 0x${validation.ackCmdId?.toString(16)}` };
  }
  if (validation.ackError !== 0) {
    return { success: false, error: `Device returned error code: ${validation.ackError}` };
  }
  return { success: true };
};
