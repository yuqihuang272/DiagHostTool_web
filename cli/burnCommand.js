/**
 * HDCP Key Burn Command
 * Orchestrates the file transfer protocol for key burning
 */

import fs from 'fs';
import path from 'path';
import { SerialClient } from './serialClient.js';
import {
  FILE_TYPE_NAMES,
  fileCrc16,
  buildStartSendFile,
  buildSendFileData,
  buildSendFileCrc,
  parseRetStartSendFile,
  parseDataAck,
  parseAckFileStatus,
  buildStartHdcp,
  buildSendHdcpData,
  buildSendHdcpCrc,
  parseRetStartHdcp,
  parseAckHdcpStatus,
} from '../shared/fileTransfer.js';

const MAX_RETRIES = 3;
const INTER_PACKET_DELAY_MS = 20;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute HDCP key burn operation
 * @param {string} portPath - serial port path
 * @param {number} baudRate - baud rate
 * @param {string} keyType - 'hdcp14' or 'hdcp22'
 * @param {string} filePath - path to key file
 * @param {object} options - {timeout, json, debug}
 * @returns {Promise<{success: boolean, error?: string, data?: object}>}
 */
export async function executeBurnCommand(portPath, baudRate, keyType, filePath, options = {}) {
  const { timeout = 5000, debug = false } = options;

  const fileType = FILE_TYPE_NAMES[keyType];
  if (fileType === undefined) {
    return { success: false, error: `Unknown key type: ${keyType}. Valid: ${Object.keys(FILE_TYPE_NAMES).join(', ')}` };
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    return { success: false, error: `File not found: ${resolvedPath}` };
  }

  const fileData = fs.readFileSync(resolvedPath);
  if (fileData.length === 0) {
    return { success: false, error: 'Key file is empty' };
  }

  const fileSize = fileData.length;
  const crc = fileCrc16(fileData);
  const fileId = (Math.random() * 0xFFFFFFFF) >>> 0;

  const log = (msg) => { if (!options.json) process.stderr.write(msg + '\n'); };
  const dbg = (msg) => { if (debug) process.stderr.write(`  [DBG] ${msg}\n`); };

  log(`Burning ${keyType} key (${fileSize} bytes) to ${portPath}...`);
  dbg(`File ID: 0x${fileId.toString(16).padStart(8, '0')}, CRC: 0x${crc.toString(16).padStart(4, '0')}`);

  const client = new SerialClient(portPath, baudRate);

  try {
    await client.connect();

    // Generic file transfer protocol (CMD 0x40-0x44)
    const useHdcpProtocol = false;

    let startResult;
    if (useHdcpProtocol) {
      // HDCP-specific protocol (CMD 0x00)
      const startCmd = buildStartHdcp(fileId);
      dbg(`TX START_HDCP: ${startCmd.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      await client.sendRaw(Buffer.from(startCmd));
      const startResp = await client.waitForResponse(timeout);
      dbg(`RX: ${Array.from(startResp).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      startResult = parseRetStartHdcp(startResp);
    } else {
      // Generic file transfer protocol (CMD 0x40)
      const startCmd = buildStartSendFile(fileId, fileSize, fileType);
      dbg(`TX START_SEND_FILE: ${startCmd.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      await client.sendRaw(Buffer.from(startCmd));
      const startResp = await client.waitForResponse(timeout);
      dbg(`RX: ${Array.from(startResp).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      startResult = parseRetStartSendFile(startResp);
    }

    if (!startResult.ok) {
      return { success: false, error: startResult.error };
    }

    const maxPacketLength = startResult.maxPacketLength;
    // Data payload per packet = max protocol packet length - header overhead (5 bytes: FF 33 LEN 03 42) - index(4) - total(4) - checksum(1)
    const dataPerPacket = maxPacketLength - 14;
    if (dataPerPacket <= 0) {
      return { success: false, error: `Invalid max packet length from device: ${maxPacketLength}` };
    }

    const totalPackets = Math.ceil(fileSize / dataPerPacket);
    log(`  Max packet: ${maxPacketLength} bytes, data/pkt: ${dataPerPacket}, total packets: ${totalPackets}`);

    // Step 2: Send file data packets (1-based index per protocol)
    for (let i = 0; i < totalPackets; i++) {
      const offset = i * dataPerPacket;
      const chunk = fileData.slice(offset, offset + dataPerPacket);
      const packetIdx = i + 1;
      const dataCmd = useHdcpProtocol
        ? buildSendHdcpData(packetIdx, totalPackets, Array.from(chunk))
        : buildSendFileData(packetIdx, totalPackets, Array.from(chunk));

      let acked = false;
      for (let retry = 0; retry < MAX_RETRIES; retry++) {
        dbg(`TX SEND_FILE_DATA pkt ${i}/${totalPackets} (retry ${retry})`);
        await client.sendRaw(Buffer.from(dataCmd));
        try {
          const ackResp = await client.waitForResponse(timeout);
          dbg(`RX ACK: ${Array.from(ackResp).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
          const ackResult = parseDataAck(ackResp);
          if (ackResult.ok) {
            acked = true;
            break;
          }
          dbg(`ACK error: ${ackResult.error}, retrying...`);
        } catch (e) {
          dbg(`Timeout waiting for ACK, retrying...`);
        }
        await delay(50);
      }

      if (!acked) {
        return { success: false, error: `Failed to send packet ${i + 1}/${totalPackets} after ${MAX_RETRIES} retries` };
      }

      if (!options.json && !debug) {
        const pct = Math.round(((i + 1) / totalPackets) * 100);
        process.stderr.write(`\r  Sending: ${i + 1}/${totalPackets} (${pct}%)`);
      }

      if (i < totalPackets - 1) {
        await delay(INTER_PACKET_DELAY_MS);
      }
    }

    if (!options.json && !debug) {
      process.stderr.write('\n');
    }

    // Step 3: Send CRC
    const crcCmd = useHdcpProtocol ? buildSendHdcpCrc(crc) : buildSendFileCrc(crc);
    dbg(`TX SEND_CRC: 0x${crc.toString(16).padStart(4, '0')}`);
    await client.sendRaw(Buffer.from(crcCmd));

    // Wait for ACK_FILE_STATUS (0x44). Device may send heartbeat ACKs (0x01 with pocketIdx=0xBBBBBBBB) while busy.
    let finalResult = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      const crcResp = await client.waitForResponse(timeout);
      dbg(`RX: ${Array.from(crcResp).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

      // Check if this is the final status response (0x44 or 0x05)
      const expectedCmd = useHdcpProtocol ? 0x05 : 0x44;
      if (crcResp[4] === expectedCmd) {
        finalResult = useHdcpProtocol ? parseAckHdcpStatus(crcResp) : parseAckFileStatus(crcResp);
        break;
      }
      // Heartbeat ACK (0x01 with 0xBBBBBBBB) - device is busy, keep waiting
      dbg(`Heartbeat received, waiting for final status...`);
    }

    if (!finalResult) {
      return { success: false, error: 'Timeout waiting for burn result' };
    }
    if (!finalResult.ok) {
      return { success: false, error: finalResult.error };
    }

    log(`  Done! ${keyType} key burned successfully.`);
    return {
      success: true,
      data: { keyType, fileSize, packets: totalPackets, crc: `0x${crc.toString(16).padStart(4, '0')}` },
    };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    await client.disconnect();
  }
}
