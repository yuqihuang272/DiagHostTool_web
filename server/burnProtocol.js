/**
 * CVTE Burn Protocol helpers for server (CommonJS)
 */

const CRC_TABLE = [
  0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50A5, 0x60C6, 0x70E7,
  0x8108, 0x9129, 0xA14A, 0xB16B, 0xC18C, 0xD1AD, 0xE1CE, 0xF1EF,
];

function fileCrc16(buffer) {
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

function calculateChecksum(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  return (0x100 - (sum & 0xFF)) & 0xFF;
}

function buildStartSendFile(fileId, fileSize, fileType) {
  const payload = [
    (fileId >>> 24) & 0xFF, (fileId >>> 16) & 0xFF, (fileId >>> 8) & 0xFF, fileId & 0xFF,
    (fileSize >>> 24) & 0xFF, (fileSize >>> 16) & 0xFF, (fileSize >>> 8) & 0xFF, fileSize & 0xFF,
    fileType,
  ];
  const packetLength = 6 + payload.length;
  const packet = [0xFF, 0x33, packetLength, 0x03, 0x40, ...payload];
  packet.push(calculateChecksum(packet.slice(2)));
  return packet;
}

function buildSendFileData(packetIndex, totalPackets, data) {
  const payload = [
    (packetIndex >>> 24) & 0xFF, (packetIndex >>> 16) & 0xFF, (packetIndex >>> 8) & 0xFF, packetIndex & 0xFF,
    (totalPackets >>> 24) & 0xFF, (totalPackets >>> 16) & 0xFF, (totalPackets >>> 8) & 0xFF, totalPackets & 0xFF,
    ...data,
  ];
  const packetLength = 6 + payload.length;
  const packet = [0xFF, 0x33, packetLength, 0x03, 0x42, ...payload];
  packet.push(calculateChecksum(packet.slice(2)));
  return packet;
}

function buildSendFileCrc(crcValue) {
  const payload = [(crcValue >>> 8) & 0xFF, crcValue & 0xFF];
  const packetLength = 6 + payload.length;
  const packet = [0xFF, 0x33, packetLength, 0x03, 0x43, ...payload];
  packet.push(calculateChecksum(packet.slice(2)));
  return packet;
}

module.exports = { fileCrc16, calculateChecksum, buildStartSendFile, buildSendFileData, buildSendFileCrc };
