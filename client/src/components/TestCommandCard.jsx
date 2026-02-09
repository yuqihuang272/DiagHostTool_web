import React, { useState, useRef, useCallback } from 'react';
import { socket } from '../socket';
import { Play, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * Reusable command card component for device testing
 * Handles command sending, response waiting, and result display
 */
export const TestCommandCard = ({
  title,
  command,
  description = '',
  parseResponse = null,
  timeout = 3000,
  enabled = true,
  isConnected = false,
}) => {
  const [status, setStatus] = useState('idle'); // 'idle' | 'pending' | 'success' | 'timeout' | 'error'
  const [result, setResult] = useState(null);
  const [rawData, setRawData] = useState(null);
  const cleanupRef = useRef(null);

  // Default parser: convert buffer to HEX string
  const defaultParser = useCallback((data) => {
    const bytes = new Uint8Array(data);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  }, []);

  const executeCommand = useCallback(() => {
    if (!isConnected || !enabled) return;

    // Cleanup any previous pending request
    if (cleanupRef.current) {
      cleanupRef.current();
    }

    setStatus('pending');
    setResult(null);
    setRawData(null);

    // Send the HEX command
    socket.emit('send-data', { data: command, type: 'hex' });

    // Listen for response
    const handleResponse = (data) => {
      setRawData(data);
      const parser = parseResponse || defaultParser;
      try {
        const parsed = parser(data);
        setResult(parsed);
        setStatus('success');
      } catch (err) {
        setResult(`Parse error: ${err.message}`);
        setStatus('error');
      }
      cleanup();
    };

    socket.on('serial-data', handleResponse);

    // Timeout handler
    const timer = setTimeout(() => {
      setStatus('timeout');
      setResult('No response within timeout period');
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
  const getStatusDisplay = () => {
    switch (status) {
      case 'pending':
        return { icon: <Loader2 size={16} className="animate-spin" />, text: '等待响应...', color: 'text-blue-500' };
      case 'success':
        return { icon: <CheckCircle size={16} />, text: '成功', color: 'text-green-500' };
      case 'timeout':
        return { icon: <Clock size={16} />, text: '超时', color: 'text-orange-500' };
      case 'error':
        return { icon: <XCircle size={16} />, text: '错误', color: 'text-red-500' };
      default:
        return { icon: null, text: '待执行', color: 'text-gray-400' };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className={clsx(
      "bg-white rounded-lg border p-4 shadow-sm",
      !enabled && "opacity-50"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-800">{title}</h3>
        <div className={clsx("flex items-center gap-1 text-sm", statusDisplay.color)}>
          {statusDisplay.icon}
          <span>{statusDisplay.text}</span>
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="text-sm text-gray-500 mb-3">{description}</p>
      )}

      {/* Command display */}
      <div className="bg-gray-50 rounded px-3 py-2 mb-3 font-mono text-sm text-gray-600">
        <span className="text-gray-400 mr-2">CMD:</span>
        {command}
      </div>

      {/* Result display */}
      {result && (
        <div className={clsx(
          "rounded px-3 py-2 mb-3 font-mono text-sm",
          status === 'success' ? "bg-green-50 text-green-700" :
          status === 'timeout' ? "bg-orange-50 text-orange-700" :
          "bg-red-50 text-red-700"
        )}>
          <span className="text-gray-400 mr-2">RES:</span>
          {result}
        </div>
      )}

      {/* Execute button */}
      <button
        onClick={executeCommand}
        disabled={!isConnected || !enabled || status === 'pending'}
        className={clsx(
          "w-full py-2 px-4 rounded font-medium flex items-center justify-center gap-2 transition",
          isConnected && enabled && status !== 'pending'
            ? "bg-blue-500 hover:bg-blue-600 text-white"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        )}
      >
        {status === 'pending' ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            执行中...
          </>
        ) : (
          <>
            <Play size={18} />
            执行
          </>
        )}
      </button>

      {/* Connection hint */}
      {!isConnected && (
        <p className="text-xs text-gray-400 mt-2 text-center">请先连接串口</p>
      )}
    </div>
  );
};
