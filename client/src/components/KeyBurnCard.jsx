import React, { useState, useRef } from 'react';
import { Upload, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { socket } from '../socket';
import { clsx } from 'clsx';

const KEY_TYPES = [
  { id: 'hdcp14', label: 'HDCP 1.4', fileTypeId: 1 },
  { id: 'hdcp22', label: 'HDCP 2.2', fileTypeId: 4 },
];

export const KeyBurnCard = ({ isConnected }) => {
  const [selectedType, setSelectedType] = useState('hdcp14');
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (f) {
      setFile(f);
      setStatus('idle');
      setMessage(`${f.name} (${f.size} bytes)`);
    }
  };

  const handleBurn = async () => {
    if (!file || !isConnected) return;

    setStatus('burning');
    setProgress(0);
    setMessage('Reading file...');

    const arrayBuffer = await file.arrayBuffer();
    const fileData = Array.from(new Uint8Array(arrayBuffer));

    const onProgress = (data) => {
      setProgress(data.percent);
      setMessage(data.message);
    };

    const onResult = (data) => {
      socket.off('burn-progress', onProgress);
      socket.off('burn-result', onResult);
      if (data.success) {
        setStatus('success');
        setMessage(`Burned successfully (${data.packets} packets, CRC: ${data.crc})`);
      } else {
        setStatus('error');
        setMessage(data.error);
      }
    };

    socket.on('burn-progress', onProgress);
    socket.on('burn-result', onResult);

    socket.emit('burn-key', {
      keyType: selectedType,
      fileData,
      fileName: file.name,
    });
  };

  const statusIcon = {
    idle: null,
    burning: <Loader2 size={16} className="animate-spin text-blue-500" />,
    success: <CheckCircle size={16} className="text-green-500" />,
    error: <XCircle size={16} className="text-red-500" />,
  };

  return (
    <div className="col-span-full border border-gray-200 rounded-lg p-3 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <Upload size={16} className="text-purple-500" />
        <span className="text-sm font-medium">Key Burn</span>
        {statusIcon[status]}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {/* Key Type */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Key Type</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            disabled={status === 'burning'}
            className="text-sm border border-gray-300 rounded px-2 py-1.5"
          >
            {KEY_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* File Select */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Key File</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".bin,.key"
            onChange={handleFileSelect}
            disabled={status === 'burning'}
            className="text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />
        </div>

        {/* Burn Button */}
        <button
          onClick={handleBurn}
          disabled={!file || !isConnected || status === 'burning'}
          className={clsx(
            "px-4 py-1.5 rounded text-sm font-medium transition",
            (!file || !isConnected || status === 'burning')
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-purple-500 text-white hover:bg-purple-600"
          )}
        >
          {status === 'burning' ? 'Burning...' : 'Burn'}
        </button>
      </div>

      {/* Progress */}
      {status === 'burning' && (
        <div className="mt-3">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-purple-500 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Status Message */}
      {message && (
        <p className={clsx("mt-2 text-xs", {
          'text-gray-500': status === 'idle',
          'text-blue-600': status === 'burning',
          'text-green-600': status === 'success',
          'text-red-600': status === 'error',
        })}>
          {message}
        </p>
      )}
    </div>
  );
};
