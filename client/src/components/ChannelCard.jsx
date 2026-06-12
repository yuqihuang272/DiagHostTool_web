import React, { useState, useRef, useCallback } from 'react';
import { socket } from '../socket';
import { Tv, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { CommandBuilder, PROTOCOL } from '../utils/cvteProtocol';
import { parsePlayChannelResponse } from '../utils/responseParsers';

/**
 * Channel play card for switching to a specific channel by ID
 */
export const ChannelPlayCard = ({ isConnected = false, timeout = 5000 }) => {
  const [channelId, setChannelId] = useState('');
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const cleanupRef = useRef(null);

  const executeCommand = useCallback(() => {
    if (!isConnected || !channelId) return;

    if (cleanupRef.current) {
      cleanupRef.current();
    }

    setStatus('pending');
    setResult(null);

    const id = parseInt(channelId);
    if (isNaN(id)) {
      setStatus('error');
      setResult({ display: 'Invalid channel ID', success: false });
      return;
    }

    const command = CommandBuilder.playChannel(id);
    socket.emit('send-data', { data: command, type: 'hex' });

    const handleResponse = (data) => {
      try {
        const parsed = parsePlayChannelResponse(data);
        setResult(parsed);
        setStatus(parsed.success ? 'success' : 'error');
      } catch (err) {
        setResult({ display: `Error: ${err.message}`, success: false });
        setStatus('error');
      }
      cleanup();
    };

    socket.on('serial-data', handleResponse);

    const timer = setTimeout(() => {
      setStatus('timeout');
      setResult({ display: 'Timeout', success: false });
      cleanup();
    }, timeout);

    const cleanup = () => {
      socket.off('serial-data', handleResponse);
      clearTimeout(timer);
      cleanupRef.current = null;
    };

    cleanupRef.current = cleanup;
  }, [isConnected, channelId, timeout]);

  const getStatusIcon = () => {
    switch (status) {
      case 'pending': return <Loader2 size={14} className="animate-spin text-blue-500" />;
      case 'success': return <CheckCircle size={14} className="text-green-500" />;
      case 'timeout':
      case 'error': return <XCircle size={14} className="text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="bg-white rounded border border-gray-200 p-2 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Tv size={14} className="text-gray-500" />
          <h3 className="text-sm font-medium text-gray-700">Play Channel</h3>
        </div>
        {getStatusIcon()}
      </div>

      <div className="flex gap-2 mb-2">
        <input
          type="number"
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          placeholder="Channel ID"
          disabled={!isConnected}
          className={
            "flex-1 px-2 py-1.5 text-sm border rounded font-mono " +
            (isConnected
              ? "border-gray-300 focus:border-blue-500 focus:outline-none"
              : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed")
          }
        />
      </div>

      {result && (
        <div className={
          "rounded px-2 py-1 mb-2 text-xs font-mono truncate " +
          (result.success === false ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600")
        }>
          {result.display || result}
        </div>
      )}

      <button
        onClick={executeCommand}
        disabled={!isConnected || !channelId || status === 'pending'}
        className={
          "w-full py-1.5 px-3 rounded text-sm font-medium flex items-center justify-center gap-1 transition " +
          (isConnected && channelId && status !== 'pending'
            ? "bg-blue-500 hover:bg-blue-600 text-white"
            : "bg-gray-200 text-gray-400 cursor-not-allowed")
        }
      >
        {status === 'pending' ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            <span>Playing...</span>
          </>
        ) : (
          <>
            <Tv size={14} />
            <span>Play</span>
          </>
        )}
      </button>
    </div>
  );
};
