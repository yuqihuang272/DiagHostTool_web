import React, { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { LogViewer } from './components/LogViewer';
import { CommandPanel } from './components/CommandPanel';
import { DeviceTestPage } from './components/DeviceTestPage';
import { socket } from './socket';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState('terminal'); // 'terminal' | 'device-test'

  useEffect(() => {
    // Listeners
    socket.on('connect', () => {
      console.log('Connected to backend');
    });

    socket.on('port-opened', (info) => {
      setIsConnected(true);
      setError('');
      addLog('sys', `Port ${info.path} opened at ${info.baudRate}`);
    });

    socket.on('port-closed', () => {
      setIsConnected(false);
      addLog('sys', 'Port closed');
    });

    socket.on('serial-data', (data) => {
      addLog('rx', data);
    });

    socket.on('port-error', (msg) => {
      setError(msg);
      addLog('err', msg);
    });

    socket.on('error', (msg) => {
       setError(msg);
    });

    return () => {
      socket.off('connect');
      socket.off('port-opened');
      socket.off('port-closed');
      socket.off('serial-data');
      socket.off('port-error');
      socket.off('error');
    };
  }, []);

  const addLog = (type, data) => {
    let processedData = data;
    if (typeof data === 'string') {
        processedData = new TextEncoder().encode(data).buffer;
    }
    
    setLogs(prev => {
        const last = prev[prev.length - 1];
        
        // Merge condition: Same type, and previous data didn't end with newline
        if (last && last.type === type && (type === 'rx' || type === 'tx')) {
            const lastView = new Uint8Array(last.data);
            const lastByte = lastView[lastView.length - 1];
            
            // Check for \n (10) or \r (13)
            // If it DOES NOT end in newline, we merge the new data into the old block
            if (lastByte !== 10 && lastByte !== 13) {
                 const newChunk = new Uint8Array(processedData);
                 const mergedBuffer = new Uint8Array(lastView.length + newChunk.length);
                 mergedBuffer.set(lastView);
                 mergedBuffer.set(newChunk, lastView.length);
                 
                 // Return all prev except last, plus updated last
                 return [...prev.slice(0, -1), { ...last, data: mergedBuffer.buffer }];
            }
        }
        
        return [...prev, { type, data: processedData, timestamp: Date.now() }];
    });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-100">
      <Sidebar
        isConnected={isConnected}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />

      {/* Terminal Page */}
      {currentPage === 'terminal' && (
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
           {/* Error Banner */}
           {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded relative flex justify-between items-center">
                <span>{error}</span>
                <button onClick={() => setError('')} className="font-bold">×</button>
              </div>
           )}

           {/* Logs - Takes up most space */}
           <div className="flex-1 min-h-0">
              <LogViewer logs={logs} onClear={() => setLogs([])} isConnected={isConnected} />
           </div>

           {/* Command Panel - Fixed height at bottom */}
           <div className="h-64 shrink-0">
              <CommandPanel isConnected={isConnected} onSend={(data, isHex) => {
                   // For TX log, if isHex is true, data is "01 02" string.
                   // We need to store it as buffer so LogViewer can toggle views.
                   if (isHex) {
                      const cleanHex = data.replace(/\s+/g, '');
                      const buffer = new Uint8Array(cleanHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
                      addLog('tx', buffer.buffer);
                   } else {
                      addLog('tx', data);
                   }
              }} />
           </div>
        </div>
      )}

      {/* Device Test Page */}
      {currentPage === 'device-test' && (
        <DeviceTestPage isConnected={isConnected} />
      )}
    </div>
  );
}

export default App;