import React, { useState, useRef, useCallback } from 'react';
import { socket } from '../socket';
import { CheckCircle, XCircle, Loader2, Send } from 'lucide-react';
import { clsx } from 'clsx';

export const MacBurnCard = ({ isConnected }) => {
  const [mac, setMac] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const cleanupRef = useRef(null);

  const isValidMac = (s) => /^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$/.test(s);

  const handleBurn = useCallback(() => {
    if (!isConnected || !isValidMac(mac)) return;

    if (cleanupRef.current) cleanupRef.current();

    setStatus('pending');
    setMessage('Writing...');

    const onResult = (data) => {
      cleanup();
      if (data.success) {
        setStatus('success');
        setMessage(`MAC ${mac} written successfully`);
      } else {
        setStatus('error');
        setMessage(data.error);
      }
    };

    socket.on('set-mac-result', onResult);
    socket.emit('set-mac', { mac });

    const timer = setTimeout(() => {
      setStatus('error');
      setMessage('Timeout');
      cleanup();
    }, 8000);

    const cleanup = () => {
      socket.off('set-mac-result', onResult);
      clearTimeout(timer);
      cleanupRef.current = null;
    };
    cleanupRef.current = cleanup;
  }, [isConnected, mac]);

  const statusIcon = {
    idle: null,
    pending: <Loader2 size={14} className="animate-spin text-blue-500" />,
    success: <CheckCircle size={14} className="text-green-500" />,
    error: <XCircle size={14} className="text-red-500" />,
  };

  return (
    <div className="bg-white rounded border border-gray-200 p-2 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium text-gray-700">Set MAC Address</h3>
        {statusIcon[status]}
      </div>

      {message && (
        <div className={clsx(
          "rounded px-2 py-1 mb-2 text-xs font-mono truncate",
          status === 'error' ? "bg-red-50 text-red-600" :
          status === 'success' ? "bg-green-50 text-green-600" :
          "bg-blue-50 text-blue-600"
        )}>
          {message}
        </div>
      )}

      <div className="flex gap-1.5">
        <input
          type="text"
          value={mac}
          onChange={(e) => { setMac(e.target.value); setStatus('idle'); setMessage(''); }}
          placeholder="AA:BB:CC:DD:EE:FF"
          maxLength={17}
          className="flex-1 px-2 py-1.5 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:border-blue-400"
        />
        <button
          onClick={handleBurn}
          disabled={!isConnected || !isValidMac(mac) || status === 'pending'}
          className={clsx(
            "px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 transition",
            isConnected && isValidMac(mac) && status !== 'pending'
              ? "bg-blue-500 hover:bg-blue-600 text-white"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          )}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
};
