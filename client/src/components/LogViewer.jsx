import React, { useRef, useEffect, useState } from 'react';
import { Trash2, Keyboard } from 'lucide-react';
import { clsx } from 'clsx';
import { socket } from '../socket';

export const LogViewer = ({ logs, onClear, isConnected }) => {
  const [viewMode, setViewMode] = useState('ascii'); // 'ascii' or 'hex'
  const [isFocused, setIsFocused] = useState(false);
  const endRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const formatData = (data) => {
    const buffer = new Uint8Array(data);
    
    if (viewMode === 'hex') {
      return Array.from(buffer)
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');
    } else {
      return new TextDecoder().decode(buffer);
    }
  };

  const handleKeyDown = (e) => {
    if (!isConnected) return;
    
    // Allow default browser actions for copy/paste/refresh etc. if modifiers are held
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    let charToSend = e.key;
    
    // Map special keys
    if (charToSend === 'Enter') {
        charToSend = '\r';
    } else if (charToSend === 'Backspace') {
        charToSend = '\x08'; 
    } else if (charToSend === 'Tab') {
        charToSend = '\t';
        e.preventDefault(); // Prevent focus loss on Tab
    } else if (charToSend.length > 1) {
        // Ignore other special keys (F1, Shift, Arrows, etc.) for now
        return;
    }

    socket.emit('send-data', { 
        data: charToSend,
        type: 'ascii' 
    });
  };

  return (
    <div 
      className={clsx(
        "flex flex-col h-full bg-white rounded-lg shadow-sm border overflow-hidden transition-colors outline-none",
        isFocused ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-200"
      )}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      ref={containerRef}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-gray-100 bg-gray-50 select-none">
        <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-700">Communication Log</h3>
            {isConnected && (
                <span className={clsx("text-xs flex items-center gap-1 px-2 py-0.5 rounded-full border", isFocused ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-gray-100 text-gray-500 border-gray-200")}>
                    <Keyboard size={12} />
                    {isFocused ? "Keyboard Active" : "Click to type"}
                </span>
            )}
        </div>
        <div className="flex gap-2">
          <div className="flex bg-gray-200 rounded p-0.5">
            <button 
              onClick={() => setViewMode('ascii')}
              className={clsx(
                "px-3 py-1 text-xs font-medium rounded transition",
                viewMode === 'ascii' ? "bg-white shadow text-blue-600" : "text-gray-600 hover:bg-gray-300"
              )}
            >
              ASCII
            </button>
            <button 
              onClick={() => setViewMode('hex')}
              className={clsx(
                "px-3 py-1 text-xs font-medium rounded transition",
                viewMode === 'hex' ? "bg-white shadow text-blue-600" : "text-gray-600 hover:bg-gray-300"
              )}
            >
              HEX
            </button>
          </div>
          <button 
            onClick={onClear}
            className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded transition"
            title="Clear Log"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Log Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-sm bg-gray-50 cursor-text" onClick={() => containerRef.current?.focus()}>
        {logs.length === 0 && (
          <div className="text-center text-gray-400 mt-10 select-none">
            {isConnected ? "Ready. Click here to type or use Send panel." : "Not connected."}
          </div>
        )}
        {logs.map((log, index) => (
          <div key={index} className="flex gap-2 items-start break-all">
            <span className="text-gray-400 text-xs mt-0.5 select-none shrink-0 w-20">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className={clsx(
              "shrink-0 px-1.5 py-0.5 rounded text-xs font-bold uppercase w-10 text-center select-none",
              log.type === 'rx' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
            )}>
              {log.type.toUpperCase()}
            </span>
            <span className={clsx(
              "flex-1 whitespace-pre-wrap",
              log.type === 'rx' ? "text-gray-800" : "text-blue-800"
            )}>
              {formatData(log.data)}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
};