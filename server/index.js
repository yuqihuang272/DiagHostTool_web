const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { SerialPort } = require('serialport');
const cors = require('cors');

const path = require('path');
const { fileCrc16, calculateChecksum, buildStartSendFile, buildSendFileData, buildSendFileCrc } = require('./burnProtocol.js');

const app = express();
app.use(cors());

// Serve static files from client/dist
app.use(express.static(path.join(__dirname, '../client/dist')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for dev simplicity
    methods: ["GET", "POST"]
  }
});

let activePort = null;

io.on('connection', (socket) => {
  console.log('Client connected');

  // List available ports
  socket.on('list-ports', async () => {
    try {
      const ports = await SerialPort.list();
      socket.emit('ports-list', ports);
    } catch (err) {
      socket.emit('error', err.message);
    }
  });

  // Open a port
  socket.on('open-port', (config) => {
    if (activePort && activePort.isOpen) {
      activePort.close();
    }

    const { path, baudRate, dataBits, stopBits, parity, flowControl } = config;

    try {
      activePort = new SerialPort({
        path,
        baudRate: parseInt(baudRate),
        dataBits: parseInt(dataBits),
        stopBits: parseFloat(stopBits), // serialport expects number (1 or 2)
        parity: parity.toLowerCase(),
        rtscts: flowControl === 'rtscts',
        xon: flowControl === 'xon',
        xoff: flowControl === 'xoff',
        autoOpen: false
      });

      activePort.open((err) => {
        if (err) {
          console.error('Error opening port:', err.message);
          socket.emit('port-error', err.message);
          return;
        }
        console.log(`Port ${path} opened`);
        socket.emit('port-opened', { path, baudRate });
      });

      activePort.on('data', (data) => {
        // Emit raw buffer. Frontend can convert to Hex/ASCII
        socket.emit('serial-data', data); 
      });

      activePort.on('error', (err) => {
        console.error('Serial port error:', err.message);
        socket.emit('port-error', err.message);
      });

      activePort.on('close', () => {
        console.log('Port closed');
        socket.emit('port-closed');
        activePort = null;
      });

    } catch (err) {
      console.error('Setup error:', err.message);
      socket.emit('port-error', err.message);
    }
  });

  // Close port
  socket.on('close-port', () => {
    if (activePort && activePort.isOpen) {
      activePort.close((err) => {
        if (err) socket.emit('error', err.message);
      });
    }
  });

  // Send data
  socket.on('send-data', (payload) => {
    // payload can be string or buffer (array of numbers)
    if (activePort && activePort.isOpen) {
      // If payload.type is 'hex', convert to Buffer
      let dataToWrite;
      if (payload.type === 'hex') {
         // Expect payload.data to be "01 02 FF" string or similar
         // Remove spaces and parse
         const cleanHex = payload.data.replace(/\s+/g, '');
         dataToWrite = Buffer.from(cleanHex, 'hex');
      } else {
         // ASCII/Text
         dataToWrite = payload.data;
         // Handle Line endings if requested (frontend logic usually, but we can do it here if needed)
         // But let's assume frontend sends exact characters including \r\n if needed
      }

      activePort.write(dataToWrite, (err) => {
        if (err) {
          socket.emit('port-error', err.message);
        } else {
            // Optional: Echo back what was sent if we want local echo
            // socket.emit('data-sent', dataToWrite);
        }
      });
    } else {
      socket.emit('error', "Port not open");
    }
  });

  // Set MAC address with server-side response handling
  socket.on('set-mac', async (payload) => {
    if (!activePort || !activePort.isOpen) {
      socket.emit('set-mac-result', { success: false, error: 'Port not open' });
      return;
    }

    const { mac } = payload;
    const parts = mac.split(/[:\-]/).map(s => parseInt(s, 16));
    if (parts.length !== 6 || parts.some(v => isNaN(v))) {
      socket.emit('set-mac-result', { success: false, error: 'Invalid MAC format' });
      return;
    }

    const pkt = [0xFF, 0x33, 0x0C, 0x03, 0x0B, ...parts];
    pkt.push(calculateChecksum(pkt.slice(2)));

    try {
      let buf = Buffer.alloc(0);
      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          activePort.off('data', onData);
          reject(new Error('Timeout'));
        }, 5000);
        const onData = (chunk) => {
          buf = Buffer.concat([buf, chunk]);
          if (buf.length >= 3 && buf.length >= buf[2]) {
            clearTimeout(timer);
            activePort.off('data', onData);
            resolve(buf.slice(0, buf[2]));
          }
        };
        activePort.on('data', onData);
        activePort.write(Buffer.from(pkt));
      });

      // ACK: byte[4]=0x01, byte[5]=errorCode, byte[6]=ackedCmd
      if (result[4] === 0x01 && result[5] === 0x00) {
        socket.emit('set-mac-result', { success: true });
      } else {
        socket.emit('set-mac-result', { success: false, error: `ACK error code: ${result[5]}` });
      }
    } catch (err) {
      socket.emit('set-mac-result', { success: false, error: err.message });
    }
  });

  // Set DSN (customer serial number) with server-side response handling
  socket.on('set-dsn', async (payload) => {
    if (!activePort || !activePort.isOpen) {
      socket.emit('set-dsn-result', { success: false, error: 'Port not open' });
      return;
    }

    const { dsn } = payload;
    if (!dsn || dsn.length === 0) {
      socket.emit('set-dsn-result', { success: false, error: 'DSN cannot be empty' });
      return;
    }

    const dsnBytes = [0x00, ...Array.from(dsn).map(c => c.charCodeAt(0))];
    const packetLen = 6 + dsnBytes.length;
    const pkt = [0xFF, 0x33, packetLen, 0x03, 0x5C, ...dsnBytes];
    pkt.push(calculateChecksum(pkt.slice(2)));

    try {
      let buf = Buffer.alloc(0);
      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { activePort.off('data', onData); reject(new Error('Timeout')); }, 10000);
        const onData = (chunk) => {
          buf = Buffer.concat([buf, chunk]);
          if (buf.length >= 3 && buf.length >= buf[2]) {
            clearTimeout(timer);
            activePort.off('data', onData);
            resolve(buf.slice(0, buf[2]));
          }
        };
        activePort.on('data', onData);
        activePort.write(Buffer.from(pkt));
      });

      if (result[4] === 0x01 && result[5] === 0x00) {
        socket.emit('set-dsn-result', { success: true });
      } else {
        socket.emit('set-dsn-result', { success: false, error: `ACK error code: ${result[5]}` });
      }
    } catch (err) {
      socket.emit('set-dsn-result', { success: false, error: err.message });
    }
  });

  // Burn key via file transfer protocol
  socket.on('burn-key', async (payload) => {
    if (!activePort || !activePort.isOpen) {
      socket.emit('burn-result', { success: false, error: 'Port not open' });
      return;
    }

    const { keyType, fileData, fileName } = payload;
    const FILE_TYPE_MAP = { hdcp14: 1, hdcp22: 4, ciplus: 2, widevine: 5, esn: 6 };
    const fileType = FILE_TYPE_MAP[keyType];
    if (!fileType) {
      socket.emit('burn-result', { success: false, error: `Unknown key type: ${keyType}` });
      return;
    }

    const fileBuf = Buffer.from(fileData);
    const fileSize = fileBuf.length;
    const crc = fileCrc16(fileBuf);
    const fileId = (Math.random() * 0xFFFFFFFF) >>> 0;

    socket.emit('burn-progress', { percent: 0, message: 'Starting...' });

    const sendAndWait = (data, timeout = 10000) => {
      return new Promise((resolve, reject) => {
        let buf = Buffer.alloc(0);
        const timer = setTimeout(() => {
          activePort.off('data', onData);
          reject(new Error('Timeout'));
        }, timeout);
        const onData = (chunk) => {
          buf = Buffer.concat([buf, chunk]);
          if (buf.length >= 3 && buf.length >= buf[2]) {
            clearTimeout(timer);
            activePort.off('data', onData);
            resolve(buf.slice(0, buf[2]));
          }
        };
        activePort.on('data', onData);
        activePort.write(Buffer.from(data));
      });
    };

    try {
      // Step 1: START_SEND_FILE
      const startCmd = buildStartSendFile(fileId, fileSize, fileType);
      const startResp = await sendAndWait(startCmd);
      if (startResp[4] !== 0x41) {
        socket.emit('burn-result', { success: false, error: 'Device rejected start command' });
        return;
      }
      if (startResp[5] !== 0) {
        socket.emit('burn-result', { success: false, error: startResp[5] === 1 ? 'Key already exists' : 'Device rejected file type' });
        return;
      }
      const maxPacketLength = (startResp[6] << 8) | startResp[7];
      const dataPerPacket = maxPacketLength - 14;
      const totalPackets = Math.ceil(fileSize / dataPerPacket);

      socket.emit('burn-progress', { percent: 5, message: `Sending ${totalPackets} packets...` });

      // Step 2: Send data packets (1-based index)
      for (let i = 0; i < totalPackets; i++) {
        const offset = i * dataPerPacket;
        const chunk = fileBuf.slice(offset, offset + dataPerPacket);
        const pktCmd = buildSendFileData(i + 1, totalPackets, Array.from(chunk));
        const ackResp = await sendAndWait(pktCmd);
        if (ackResp[5] !== 0) {
          socket.emit('burn-result', { success: false, error: `Packet ${i + 1} ACK error` });
          return;
        }
        const pct = Math.round(5 + ((i + 1) / totalPackets) * 80);
        socket.emit('burn-progress', { percent: pct, message: `Packet ${i + 1}/${totalPackets}` });
      }

      // Step 3: Send CRC and wait for final status
      socket.emit('burn-progress', { percent: 90, message: 'Verifying CRC...' });
      const crcCmd = buildSendFileCrc(crc);

      const waitForPacket = (timeout = 15000) => {
        return new Promise((resolve, reject) => {
          let buf = Buffer.alloc(0);
          const timer = setTimeout(() => { activePort.off('data', onData); reject(new Error('Timeout')); }, timeout);
          const onData = (chunk) => {
            buf = Buffer.concat([buf, chunk]);
            if (buf.length >= 3 && buf.length >= buf[2]) {
              clearTimeout(timer);
              activePort.off('data', onData);
              resolve(buf.slice(0, buf[2]));
            }
          };
          activePort.on('data', onData);
        });
      };

      activePort.write(Buffer.from(crcCmd));

      let finalStatus = null;
      for (let attempt = 0; attempt < 20; attempt++) {
        const resp = await waitForPacket(15000);
        if (resp[4] === 0x44) {
          finalStatus = resp[5];
          break;
        }
      }

      if (finalStatus === null) {
        socket.emit('burn-result', { success: false, error: 'Timeout waiting for result' });
      } else if (finalStatus === 0) {
        socket.emit('burn-progress', { percent: 100, message: 'Done!' });
        socket.emit('burn-result', { success: true, packets: totalPackets, crc: '0x' + crc.toString(16).padStart(4, '0') });
      } else {
        socket.emit('burn-result', { success: false, error: finalStatus === 1 ? 'CRC error' : 'Flash write error' });
      }
    } catch (err) {
      socket.emit('burn-result', { success: false, error: err.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    // Optional: Close port on client disconnect? 
    // Usually better to keep it open for persistence unless explicit close, 
    // but for a single-user tool, closing might be safer.
    // Let's leave it open for now to allow page refresh without losing connection.
  });
});

// Graceful shutdown to release serial port lock
const cleanup = () => {
  if (activePort && activePort.isOpen) {
    console.log('Closing port on exit...');
    activePort.close((err) => {
      if (err) console.error('Error closing port:', err);
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
// Nodemon restart signal
process.on('SIGUSR2', () => {
  if (activePort && activePort.isOpen) {
    activePort.close(() => process.kill(process.pid, 'SIGUSR2'));
  } else {
    process.kill(process.pid, 'SIGUSR2');
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
