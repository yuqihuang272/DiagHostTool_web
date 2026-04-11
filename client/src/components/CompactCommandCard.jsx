import React, { useState, useRef, useCallback } from 'react';
import { socket } from '../socket';
import { Play, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * Compact command card component for device testing
 * Smaller padding, no HEX command display, compact result area
 */
export const CompactCommandCard = ({
  title,
  command,
  parseResponse = null,
  timeout = 3000,
  enabled = true,
  isConnected = false,
  icon: Icon = null,
}) => {
  const [status, setStatus] = useState('idle'); // 'idle' | 'pending' | 'success' | 'timeout' | 'error'
  const [result, setResult] = useState(null);
  const cleanupRef = useRef(null);

  // Default parser: convert buffer to HEX string
  const defaultParser = useCallback((data) => {
    const bytes = new Uint8Array(data);
    const hexStr = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
    return { success: true, display: hexStr };
  }, []);

  const executeCommand = useCallback(() => {
    if (!isConnected || !enabled) return;

    // Cleanup any previous pending request
    if (cleanupRef.current) {
      cleanupRef.current();
    }

    setStatus('pending');
    setResult(null);

    // Send the HEX command
    socket.emit('send-data', { data: command, type: 'hex' });

    // Listen for response
    const handleResponse = (data) => {
      const parser = parseResponse || defaultParser;
      try {
        const parsed = parser(data);
        if (typeof parsed === 'string') {
          setResult({ display: parsed, success: true });
        } else {
          setResult(parsed);
        }
        setStatus(parsed.success === false ? 'error' : 'success');
      } catch (err) {
        setResult({ display: `Parse error: ${err.message}`, success: false });
        setStatus('error');
      }
      cleanup();
    };

    socket.on('serial-data', handleResponse);

    // Timeout handler
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
  }, [isConnected, enabled, command, parseResponse, defaultParser, timeout]);

  // Status icon and color
  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return <Loader2 size={14} className="animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle size={14} className="text-green-500" />;
      case 'timeout':
      case 'error':
        return <XCircle size={14} className="text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className={clsx(
      "bg-white rounded border border-gray-200 p-2 shadow-sm",
      !enabled && "opacity-50"
    )}>
      {/* Header with title and status */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon size={14} className="text-gray-500" />}
          <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        </div>
        {getStatusIcon()}
      </div>

      {/* Result display - compact */}
      {result && (
        <div className={clsx(
          "rounded px-2 py-1 mb-2 text-xs font-mono truncate",
          result.success === false ? "bg-red-50 text-red-600" :
          "bg-green-50 text-green-600"
        )}>
          {result.display || result}
        </div>
      )}

      {/* Execute button - compact */}
      <button
        onClick={executeCommand}
        disabled={!isConnected || !enabled || status === 'pending'}
        className={clsx(
          "w-full py-1.5 px-3 rounded text-sm font-medium flex items-center justify-center gap-1 transition",
          isConnected && enabled && status !== 'pending'
            ? "bg-blue-500 hover:bg-blue-600 text-white"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        )}
      >
        {status === 'pending' ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            <span>Running...</span>
          </>
        ) : (
          <>
            <Play size={14} />
            <span>Run</span>
          </>
        )}
      </button>
    </div>
  );
};
