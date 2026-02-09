const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { SerialPort } = require('serialport');
const cors = require('cors');

const path = require('path');

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
