/**
 * CVTE File Transfer Protocol (Section 4.27)
 * Used for key burning (HDCP 1.4, HDCP 2.2, etc.)
 */

import { PROTOCOL, calculateChecksum } from './cvteProtocol.js';

export const FILE_TYPE = {
  HDCP_14: 1,
  CI_PLUS: 2,
  HDCP_20: 3,
  HDCP_22: 4,
  WIDEVINE: 5,
  ESN: 6,
};

export const FILE_TYPE_NAMES = {
  hdcp14: FILE_TYPE.HDCP_14,
  hdcp22: FILE_TYPE.HDCP_22,
  ciplus: FILE_TYPE.CI_PLUS,
  hdcp20: FILE_TYPE.HDCP_20,
  widevine: FILE_TYPE.WIDEVINE,
  esn: FILE_TYPE.ESN,
};

export const FILE_STATUS = {
  OK: 0,
  ALREADY_EXIST: 1,
  REJECTED: 2,
};

export const BURN_STATUS = {
  OK: 0,
  CRC_ERROR: 1,
  FLASH_ERROR: 2,
};

const CRC_TABLE = [
  0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50A5, 0x60C6, 0x70E7,
  0x8108, 0x9129, 0xA14A, 0xB16B, 0xC18C, 0xD1AD, 0xE1CE, 0xF1EF,
];

/**
 * Calculate 16-bit CRC for file content
 * Uses CVTE's nibble-based CRC16 with 16-entry lookup table
 */
export function fileCrc16(buffer) {
  let crc = 0;
  for (let i = 0; i < buffer.length; i++) {
    const b = buffer[i];
    let temp = (crc >> 12) & 0xF;
    crc = (crc << 4) & 0xFFFF;
    crc ^= CRC_TABLE[(temp ^ ((b >> 4) & 0xF)) & 0xF];

    temp = (crc >> 12) & 0xF;
    crc = (crc << 4) & 0xFFFF;
    crc ^= CRC_TABLE[(temp ^ (b & 0xF)) & 0xF];
  }
  return crc & 0xFFFF;
}

/**
 * Build START_SEND_FILE command (0x40) - generic file transfer
 * Packet: FF 33 0F 03 40 [FILE_ID x4] [FILE_SIZE x4] [FILE_TYPE] [CHECKSUM]
 */
export function buildStartSendFile(fileId, fileSize, fileType) {
  const payload = [
    (fileId >>> 24) & 0xFF,
    (fileId >>> 16) & 0xFF,
    (fileId >>> 8) & 0xFF,
    fileId & 0xFF,
    (fileSize >>> 24) & 0xFF,
    (fileSize >>> 16) & 0xFF,
    (fileSize >>> 8) & 0xFF,
    fileSize & 0xFF,
    fileType,
  ];
  const packetLength = 6 + payload.length;
  const packet = [
    PROTOCOL.SYNC_BYTE,
    PROTOCOL.START_BYTE,
    packetLength,
    PROTOCOL.PROTOCOL_TYPE,
    PROTOCOL.CMD.START_SEND_FILE,
    ...payload,
  ];
  packet.push(calculateChecksum(packet.slice(2)));
  return packet;
}

// ============================================================
// HDCP-specific protocol (CMD 0x00-0x05) for legacy devices
// ============================================================

/**
 * Build START_HDCP command (0x00)
 * Packet: FF 33 0A 03 00 [FILE_ID x4] [CHECKSUM]
 */
export function buildStartHdcp(fileId) {
  const payload = [
    (fileId >>> 24) & 0xFF,
    (fileId >>> 16) & 0xFF,
    (fileId >>> 8) & 0xFF,
    fileId & 0xFF,
  ];
  const packetLength = 6 + payload.length;
  const packet = [
    PROTOCOL.SYNC_BYTE,
    PROTOCOL.START_BYTE,
    packetLength,
    PROTOCOL.PROTOCOL_TYPE,
    0x00, // START_HDCP CMD
    ...payload,
  ];
  packet.push(calculateChecksum(packet.slice(2)));
  return packet;
}

/**
 * Build SEND_HDCP_DATA command (0x03)
 * Same format as SEND_FILE_DATA but CMD=0x03
 */
export function buildSendHdcpData(packetIndex, totalPackets, data) {
  const payload = [
    (packetIndex >>> 24) & 0xFF,
    (packetIndex >>> 16) & 0xFF,
    (packetIndex >>> 8) & 0xFF,
    packetIndex & 0xFF,
    (totalPackets >>> 24) & 0xFF,
    (totalPackets >>> 16) & 0xFF,
    (totalPackets >>> 8) & 0xFF,
    totalPackets & 0xFF,
    ...data,
  ];
  const packetLength = 6 + payload.length;
  const packet = [
    PROTOCOL.SYNC_BYTE,
    PROTOCOL.START_BYTE,
    packetLength,
    PROTOCOL.PROTOCOL_TYPE,
    0x03, // SEND_HDCP_DATA CMD
    ...payload,
  ];
  packet.push(calculateChecksum(packet.slice(2)));
  return packet;
}

/**
 * Build SEND_HDCP_CRC command (0x04)
 * Packet: FF 33 08 03 04 [CRC_HI] [CRC_LO] [CHECKSUM]
 */
export function buildSendHdcpCrc(crcValue) {
  const payload = [
    (crcValue >>> 8) & 0xFF,
    crcValue & 0xFF,
  ];
  const packetLength = 6 + payload.length;
  const packet = [
    PROTOCOL.SYNC_BYTE,
    PROTOCOL.START_BYTE,
    packetLength,
    PROTOCOL.PROTOCOL_TYPE,
    0x04, // SEND_HDCP_CRC CMD
    ...payload,
  ];
  packet.push(calculateChecksum(packet.slice(2)));
  return packet;
}

/**
 * Parse RET_START_HDCP (0x02) response
 * Format: FF 33 09 03 02 [STATUS] [MAX_LEN_HI] [MAX_LEN_LO] [CHECKSUM]
 */
export function parseRetStartHdcp(data) {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);

  if (bytes.length < 6) {
    return { ok: false, error: 'Response too short' };
  }
  if (bytes[0] !== 0xFF || bytes[1] !== 0x33) {
    return { ok: false, error: 'Invalid header' };
  }
  if (bytes[4] === PROTOCOL.CMD.ACK) {
    const errorCode = bytes[5];
    return { ok: false, error: `Device NAK: error code ${errorCode}` };
  }
  if (bytes[4] !== 0x02) {
    return { ok: false, error: `Unexpected response CMD: 0x${bytes[4].toString(16)}` };
  }

  const status = bytes[5];
  const maxPacketLength = (bytes[6] << 8) | bytes[7];

  if (status !== 0) {
    return { ok: false, status, error: status === 1 ? 'Key already exists on device' : 'Device rejected' };
  }

  return { ok: true, status, maxPacketLength };
}

/**
 * Parse ACK_HDCP_STATUS (0x05) response
 * Format: FF 33 07 03 05 [STATUS] [CHECKSUM]
 */
export function parseAckHdcpStatus(data) {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);

  if (bytes.length < 7) {
    return { ok: false, error: 'Response too short' };
  }
  if (bytes[4] !== 0x05) {
    if (bytes[4] === PROTOCOL.CMD.ACK) {
      const errorCode = bytes[5];
      return { ok: false, error: `Device NAK: error code ${errorCode}` };
    }
    return { ok: false, error: `Unexpected response CMD: 0x${bytes[4].toString(16)}` };
  }

  const status = bytes[5];
  if (status === 0) return { ok: true, status };
  if (status === 1) return { ok: false, status, error: 'CRC verification failed on device' };
  return { ok: false, status, error: 'Flash write error' };
}

/**
 * Build SEND_FILE_DATA command (0x42)
 * Packet: FF 33 NN 03 42 [POCKET_INDEX x4] [TOTAL_COUNT x4] [DATA...] [CHECKSUM]
 */
export function buildSendFileData(packetIndex, totalPackets, data) {
  const payload = [
    (packetIndex >>> 24) & 0xFF,
    (packetIndex >>> 16) & 0xFF,
    (packetIndex >>> 8) & 0xFF,
    packetIndex & 0xFF,
    (totalPackets >>> 24) & 0xFF,
    (totalPackets >>> 16) & 0xFF,
    (totalPackets >>> 8) & 0xFF,
    totalPackets & 0xFF,
    ...data,
  ];
  const packetLength = 6 + payload.length;
  const packet = [
    PROTOCOL.SYNC_BYTE,
    PROTOCOL.START_BYTE,
    packetLength,
    PROTOCOL.PROTOCOL_TYPE,
    PROTOCOL.CMD.SEND_FILE_DATA,
    ...payload,
  ];
  packet.push(calculateChecksum(packet.slice(2)));
  return packet;
}

/**
 * Build SEND_FILE_CRC command (0x43)
 * Packet: FF 33 08 03 43 [CRC_HI] [CRC_LO] [CHECKSUM]
 */
export function buildSendFileCrc(crcValue) {
  const payload = [
    (crcValue >>> 8) & 0xFF,
    crcValue & 0xFF,
  ];
  const packetLength = 6 + payload.length;
  const packet = [
    PROTOCOL.SYNC_BYTE,
    PROTOCOL.START_BYTE,
    packetLength,
    PROTOCOL.PROTOCOL_TYPE,
    PROTOCOL.CMD.SEND_FILE_CRC,
    ...payload,
  ];
  packet.push(calculateChecksum(packet.slice(2)));
  return packet;
}

/**
 * Parse RET_START_SEND_FILE (0x41) response
 * Format: FF 33 09 03 41 [STATUS] [MAX_LEN_HI] [MAX_LEN_LO] [CHECKSUM]
 */
export function parseRetStartSendFile(data) {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);

  if (bytes.length < 9) {
    return { ok: false, error: 'Response too short' };
  }
  if (bytes[0] !== 0xFF || bytes[1] !== 0x33) {
    return { ok: false, error: 'Invalid header' };
  }
  if (bytes[4] !== PROTOCOL.CMD.RET_START_SEND_FILE) {
    if (bytes[4] === PROTOCOL.CMD.ACK) {
      const errorCode = bytes[5];
      return { ok: false, error: `Device NAK: error code ${errorCode}` };
    }
    return { ok: false, error: `Unexpected response CMD: 0x${bytes[4].toString(16)}` };
  }

  const status = bytes[5];
  const maxPacketLength = (bytes[6] << 8) | bytes[7];

  if (status !== FILE_STATUS.OK) {
    const msg = status === FILE_STATUS.ALREADY_EXIST ? 'Key already exists on device' : 'Device rejected file type';
    return { ok: false, status, error: msg };
  }

  return { ok: true, status, maxPacketLength };
}

/**
 * Parse ACK for SEND_FILE_DATA / SEND_HDCP_DATA (standard ACK with pocket index)
 * Format: FF 33 0C 03 01 [ERROR] [CMD_ID] [PKT_IDX x4] [CHECKSUM]
 */
export function parseDataAck(data) {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);

  if (bytes.length < 6) {
    return { ok: false, error: 'Response too short' };
  }
  if (bytes[4] !== PROTOCOL.CMD.ACK) {
    return { ok: false, error: `Unexpected response: 0x${bytes[4].toString(16)}` };
  }

  const errorCode = bytes[5];
  const ackedCmd = bytes[6];
  if (errorCode !== 0) {
    return { ok: false, error: `ACK error code: ${errorCode}` };
  }
  // Accept ACK for either SEND_FILE_DATA (0x42) or SEND_HDCP_DATA (0x03)
  if (ackedCmd !== PROTOCOL.CMD.SEND_FILE_DATA && ackedCmd !== 0x03) {
    return { ok: false, error: `ACK for wrong CMD: 0x${ackedCmd.toString(16)}` };
  }

  const pocketIndex = ((bytes[7] << 24) | (bytes[8] << 16) | (bytes[9] << 8) | bytes[10]) >>> 0;
  return { ok: true, pocketIndex };
}

/**
 * Parse ACK_FILE_STATUS (0x44) response
 * Format: FF 33 07 03 44 [STATUS] [CHECKSUM]
 */
export function parseAckFileStatus(data) {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);

  if (bytes.length < 7) {
    return { ok: false, error: 'Response too short' };
  }
  if (bytes[4] !== PROTOCOL.CMD.ACK_FILE_STATUS) {
    if (bytes[4] === PROTOCOL.CMD.ACK) {
      const errorCode = bytes[5];
      return { ok: false, error: `Device NAK: error code ${errorCode}` };
    }
    return { ok: false, error: `Unexpected response CMD: 0x${bytes[4].toString(16)}` };
  }

  const status = bytes[5];
  if (status === BURN_STATUS.OK) {
    return { ok: true, status };
  } else if (status === BURN_STATUS.CRC_ERROR) {
    return { ok: false, status, error: 'CRC verification failed on device' };
  } else {
    return { ok: false, status, error: 'Flash write error' };
  }
}
