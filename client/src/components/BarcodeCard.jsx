import React, { useState, useRef, useCallback } from 'react';
import { socket } from '../socket';
import { CheckCircle, XCircle, Loader2, Send, Download } from 'lucide-react';
import { clsx } from 'clsx';

export const BarcodeCard = ({ isConnected }) => {
  const [barcode, setBarcode] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const cleanupRef = useRef(null);

  const handleSet = useCallback(() => {
    if (!isConnected || !barcode.trim()) return;

    if (cleanupRef.current) cleanupRef.current();

    setStatus('pending');
    setMessage('Writing...');

    const onResult = (data) => {
      cleanup();
      if (data.success) {
        setStatus('success');
        setMessage(`Barcode written: ${barcode}`);
      } else {
        setStatus('error');
        setMessage(data.error);
      }
    };

    socket.on('set-barcode-result', onResult);
    socket.emit('set-barcode', { barcode: barcode.trim() });

    const timer = setTimeout(() => {
      setStatus('error');
      setMessage('Timeout');
      cleanup();
    }, 15000);

    const cleanup = () => {
      socket.off('set-barcode-result', onResult);
      clearTimeout(timer);
      cleanupRef.current = null;
    };
    cleanupRef.current = cleanup;
  }, [isConnected, barcode]);

  const handleGet = useCallback(() => {
    if (!isConnected) return;

    if (cleanupRef.current) cleanupRef.current();

    setStatus('pending');
    setMessage('Reading...');

    const onResult = (data) => {
      cleanup();
      if (data.success) {
        setStatus('success');
        setMessage(`Barcode: ${data.barcode || '(empty)'}`);
      } else {
        setStatus('error');
        setMessage(data.error);
      }
    };

    socket.on('get-barcode-result', onResult);
    socket.emit('get-barcode');

    const timer = setTimeout(() => {
      setStatus('error');
      setMessage('Timeout');
      cleanup();
    }, 15000);

    const cleanup = () => {
      socket.off('get-barcode-result', onResult);
      clearTimeout(timer);
      cleanupRef.current = null;
    };
    cleanupRef.current = cleanup;
  }, [isConnected]);

  const statusIcon = {
    idle: null,
    pending: <Loader2 size={14} className="animate-spin text-blue-500" />,
    success: <CheckCircle size={14} className="text-green-500" />,
    error: <XCircle size={14} className="text-red-500" />,
  };

  return (
    <div className="bg-white rounded border border-gray-200 p-2 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium text-gray-700">Barcode (factory station)</h3>
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
          value={barcode}
          onChange={(e) => { setBarcode(e.target.value); setStatus('idle'); setMessage(''); }}
          placeholder="barcode value"
          className="flex-1 px-2 py-1.5 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:border-blue-400"
        />
        <button
          onClick={handleSet}
          disabled={!isConnected || !barcode.trim() || status === 'pending'}
          className={clsx(
            "px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 transition",
            isConnected && barcode.trim() && status !== 'pending'
              ? "bg-blue-500 hover:bg-blue-600 text-white"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          )}
        >
          <Send size={14} />
        </button>
        <button
          onClick={handleGet}
          disabled={!isConnected || status === 'pending'}
          className={clsx(
            "px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 transition",
            isConnected && status !== 'pending'
              ? "bg-gray-500 hover:bg-gray-600 text-white"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          )}
        >
          <Download size={14} />
        </button>
      </div>
    </div>
  );
};
