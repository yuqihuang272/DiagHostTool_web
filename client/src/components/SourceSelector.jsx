import React, { useState, useRef, useCallback } from 'react';
import { socket } from '../socket';
import { Tv, CheckCircle, XCircle, Loader2, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { PROTOCOL, SOURCE_NAMES, buildCommandHex } from '../utils/cvteProtocol';
import { parseSetSourceResponse, parseSourceResponse } from '../utils/responseParsers';

/**
 * Source selector component with dropdown and execute button
 * Merges all source switching commands into one compact UI
 */
export const SourceSelector = ({
  isConnected = false,
  timeout = 3000,
}) => {
  const [selectedSource, setSelectedSource] = useState('HDMI1');
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const cleanupRef = useRef(null);

  // Available sources from PROTOCOL.SOURCE
  const sources = [
    { id: PROTOCOL.SOURCE.ATV, name: 'ATV', group: 'TV' },
    { id: PROTOCOL.SOURCE.DTV, name: 'DTV', group: 'TV' },
    { id: PROTOCOL.SOURCE.VGA, name: 'VGA', group: 'PC' },
    { id: PROTOCOL.SOURCE.HDMI1, name: 'HDMI1', group: 'HDMI' },
    { id: PROTOCOL.SOURCE.HDMI2, name: 'HDMI2', group: 'HDMI' },
    { id: PROTOCOL.SOURCE.HDMI3, name: 'HDMI3', group: 'HDMI' },
    { id: PROTOCOL.SOURCE.HDMI4, name: 'HDMI4', group: 'HDMI' },
    { id: PROTOCOL.SOURCE.HDMI5, name: 'HDMI5', group: 'HDMI' },
    { id: PROTOCOL.SOURCE.AV1, name: 'AV1', group: 'AV' },
    { id: PROTOCOL.SOURCE.AV2, name: 'AV2', group: 'AV' },
    { id: PROTOCOL.SOURCE.USB1, name: 'USB1', group: 'USB' },
    { id: PROTOCOL.SOURCE.USB2, name: 'USB2', group: 'USB' },
  ];

  // Group sources for organized display
  const groupedSources = sources.reduce((acc, source) => {
    if (!acc[source.group]) {
      acc[source.group] = [];
    }
    acc[source.group].push(source);
    return acc;
  }, {});

  const executeCommand = useCallback(() => {
    if (!isConnected) return;

    // Cleanup any previous pending request
    if (cleanupRef.current) {
      cleanupRef.current();
    }

    setStatus('pending');
    setResult(null);

    // Find the source ID
    const source = sources.find(s => s.name === selectedSource);
    if (!source) {
      setStatus('error');
      setResult({ display: 'Invalid source', success: false });
      return;
    }

    // Build and send the command
    const command = buildCommandHex(PROTOCOL.CMD.SET_SOURCE, [source.id]);
    socket.emit('send-data', { data: command, type: 'hex' });

    // Listen for response
    const handleResponse = (data) => {
      try {
        const parsed = parseSetSourceResponse(data, selectedSource);
        setResult(parsed);
        setStatus(parsed.success ? 'success' : 'error');
      } catch (err) {
        setResult({ display: `Error: ${err.message}`, success: false });
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
  }, [isConnected, selectedSource, timeout]);

  // Status icon
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
    <div className="bg-white rounded border border-gray-200 p-2 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Tv size={14} className="text-gray-500" />
          <h3 className="text-sm font-medium text-gray-700">Switch Source</h3>
        </div>
        {getStatusIcon()}
      </div>

      {/* Dropdown selector */}
      <select
        value={selectedSource}
        onChange={(e) => setSelectedSource(e.target.value)}
        disabled={!isConnected}
        className={clsx(
          "w-full mb-2 px-2 py-1.5 text-sm border rounded bg-white",
          isConnected
            ? "border-gray-300 focus:border-blue-500 focus:outline-none"
            : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
        )}
      >
        {Object.entries(groupedSources).map(([group, groupSources]) => (
          <optgroup key={group} label={group}>
            {groupSources.map((source) => (
              <option key={source.id} value={source.name}>
                {source.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Result display */}
      {result && (
        <div className={clsx(
          "rounded px-2 py-1 mb-2 text-xs font-mono truncate",
          result.success === false ? "bg-red-50 text-red-600" :
          "bg-green-50 text-green-600"
        )}>
          {result.display || result}
        </div>
      )}

      {/* Execute button */}
      <button
        onClick={executeCommand}
        disabled={!isConnected || status === 'pending'}
        className={clsx(
          "w-full py-1.5 px-3 rounded text-sm font-medium flex items-center justify-center gap-1 transition",
          isConnected && status !== 'pending'
            ? "bg-blue-500 hover:bg-blue-600 text-white"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        )}
      >
        {status === 'pending' ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            <span>Switching...</span>
          </>
        ) : (
          <>
            <Tv size={14} />
            <span>Switch</span>
          </>
        )}
      </button>
    </div>
  );
};

/**
 * Get Current Source component
 */
export const GetCurrentSource = ({
  isConnected = false,
  timeout = 3000,
}) => {
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const cleanupRef = useRef(null);

  const command = buildCommandHex(PROTOCOL.CMD.GET_SOURCE);

  const executeCommand = useCallback(() => {
    if (!isConnected) return;

    if (cleanupRef.current) {
      cleanupRef.current();
    }

    setStatus('pending');
    setResult(null);

    socket.emit('send-data', { data: command, type: 'hex' });

    const handleResponse = (data) => {
      try {
        const parsed = parseSourceResponse(data);
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
  }, [isConnected, command, timeout]);

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
    <div className="bg-white rounded border border-gray-200 p-2 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Tv size={14} className="text-gray-500" />
          <h3 className="text-sm font-medium text-gray-700">Current Source</h3>
        </div>
        {getStatusIcon()}
      </div>

      {result && (
        <div className={clsx(
          "rounded px-2 py-1 mb-2 text-xs font-mono truncate",
          result.success === false ? "bg-red-50 text-red-600" :
          "bg-green-50 text-green-600"
        )}>
          {result.display || result}
        </div>
      )}

      <button
        onClick={executeCommand}
        disabled={!isConnected || status === 'pending'}
        className={clsx(
          "w-full py-1.5 px-3 rounded text-sm font-medium flex items-center justify-center gap-1 transition",
          isConnected && status !== 'pending'
            ? "bg-blue-500 hover:bg-blue-600 text-white"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        )}
      >
        {status === 'pending' ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            <span>Querying...</span>
          </>
        ) : (
          <>
            <Tv size={14} />
            <span>Query</span>
          </>
        )}
      </button>
    </div>
  );
};
