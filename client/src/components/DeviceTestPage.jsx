import React, { useState } from 'react';
import { CompactCommandCard } from './CompactCommandCard';
import { SourceSelector, GetCurrentSource } from './SourceSelector';
import { KeyBurnCard } from './KeyBurnCard';
import { MacBurnCard } from './MacBurnCard';
import { DsnCard } from './DsnCard';
import { ChannelPlayCard } from './ChannelCard';
import { Cpu, Info, TestTube, Tv, Key, Volume2, Hash } from 'lucide-react';
import { COMMANDS, CommandBuilder, parseKeyIdResponse as _parseKeyId, PROTOCOL } from '../utils/cvteProtocol';
import {
  parseChecksumResponse,
  parseIpResponse,
  parseWifiResponse,
  parseBluetoothResponse,
  parseMacResponse,
  parseChannelListResponse,
} from '../utils/responseParsers';
import { socket } from '../socket';
import { clsx } from 'clsx';

/**
 * Device Test Page - Optimized with tabs and compact layout
 *
 * Tabs:
 * - Info Query (信息查询): Checksum, IP, MAC
 * - Module Test (模块测试): WiFi, Bluetooth
 * - Source Control (信源控制): Switch source, Get current source
 *
 * Based on CVTE Factory Auto Test Serial Communication Protocol v2.1.51
 */
export const DeviceTestPage = ({ isConnected }) => {
  const [activeTab, setActiveTab] = useState('info');

  const parseKeyId = (data) => {
    const r = _parseKeyId(data);
    if (!r.success) return { success: false, display: r.error || 'Unknown error' };
    return { success: true, display: r.keyName || '(empty)' };
  };

  const tabs = [
    { id: 'info', label: 'Info Query', labelCN: '信息查询', icon: Info },
    { id: 'test', label: 'Module Test', labelCN: '模块测试', icon: TestTube },
    { id: 'source', label: 'Source Control', labelCN: '信源控制', icon: Tv },
    { id: 'channel', label: 'Channel', labelCN: '频道控制', icon: Hash },
    { id: 'burn', label: 'Key Burn', labelCN: '密钥烧录', icon: Key },
  ];

  // Info query commands
  const infoCommands = [
    {
      id: 'checksum',
      title: 'Checksum',
      command: COMMANDS.GET_CHECKSUM,
      timeout: 3000,
      parseResponse: parseChecksumResponse,
    },
    {
      id: 'ip',
      title: 'IP Address',
      command: COMMANDS.GET_IP,
      timeout: 3000,
      parseResponse: parseIpResponse,
    },
    {
      id: 'mac',
      title: 'MAC Address',
      command: COMMANDS.GET_MAC_ADDR,
      timeout: 3000,
      parseResponse: parseMacResponse,
    },
    {
      id: 'hdcp14',
      title: 'HDCP 1.4 Key',
      command: CommandBuilder.getKeyId(1),
      timeout: 3000,
      parseResponse: parseKeyId,
    },
    {
      id: 'hdcp22',
      title: 'HDCP 2.2 Key',
      command: CommandBuilder.getKeyId(4),
      timeout: 3000,
      parseResponse: parseKeyId,
    },
  ];

  // Module test commands
  const testCommands = [
    {
      id: 'wifi',
      title: 'WiFi Test',
      command: COMMANDS.GET_WIFI_STATUS,
      timeout: 5000,
      parseResponse: parseWifiResponse,
    },
    {
      id: 'bluetooth',
      title: 'Bluetooth Test',
      command: COMMANDS.GET_BLUETOOTH_STATUS,
      timeout: 5000,
      parseResponse: parseBluetoothResponse,
    },
  ];

  return (
    <div className="flex-1 flex flex-col p-2 gap-2 overflow-hidden">
      {/* Page Header - Compact */}
      <div className="flex items-center gap-2 pb-1.5 border-b border-gray-200">
        <Cpu size={20} className="text-blue-500" />
        <h1 className="text-lg font-semibold text-gray-800">Device Test</h1>
        <span className={clsx(
          "ml-auto px-2 py-0.5 rounded text-xs font-medium",
          isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        )}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition border-b-2 -mb-px",
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <TabIcon size={14} />
              <span>{tab.labelCN}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Info Query Tab */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {infoCommands.map((cmd) => (
              <CompactCommandCard
                key={cmd.id}
                title={cmd.title}
                command={cmd.command}
                timeout={cmd.timeout}
                parseResponse={cmd.parseResponse}
                isConnected={isConnected}
              />
            ))}
            <MacBurnCard isConnected={isConnected} />
            <DsnCard isConnected={isConnected} />
          </div>
        )}

        {/* Module Test Tab */}
        {activeTab === 'test' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {testCommands.map((cmd) => (
              <CompactCommandCard
                key={cmd.id}
                title={cmd.title}
                command={cmd.command}
                timeout={cmd.timeout}
                parseResponse={cmd.parseResponse}
                isConnected={isConnected}
              />
            ))}
          </div>
        )}

        {/* Source Control Tab */}
        {activeTab === 'source' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            <SourceSelector isConnected={isConnected} />
            <GetCurrentSource isConnected={isConnected} />
            <SetVolumeCard isConnected={isConnected} />
          </div>
        )}

        {/* Channel Tab */}
        {activeTab === 'channel' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            <GetChannelListCard isConnected={isConnected} />
            <ChannelPlayCard isConnected={isConnected} />
            <SetChannelNumberCard isConnected={isConnected} />
          </div>
        )}

        {/* Key Burn Tab */}
        {activeTab === 'burn' && (
          <div className="grid grid-cols-1 gap-2">
            <KeyBurnCard isConnected={isConnected} />
          </div>
        )}
      </div>

      {/* Protocol Info Bar - Compact */}
      <div className="bg-blue-50 border border-blue-200 rounded px-2 py-1 text-xs text-blue-700 flex items-center gap-3">
        <span><strong>Protocol:</strong> CVTE v2.1.51</span>
        <span><strong>Baud:</strong> 115200</span>
        <span><strong>Format:</strong> 8N1</span>
      </div>
    </div>
  );
};

// ---- Inline Cards for Volume / Channel ----

/**
 * Volume set card
 */
const SetVolumeCard = ({ isConnected }) => {
  const [volume, setVolume] = useState(50);
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);

  const handleSet = () => {
    if (!isConnected) return;
    setStatus('pending');
    setResult(null);

    const command = CommandBuilder.setVolume(volume);
    socket.emit('send-data', { data: command, type: 'hex' });

    const timer = setTimeout(() => {
      setStatus('timeout');
      setResult({ display: 'Timeout', success: false });
      cleanup();
    }, 3000);

    const handleResponse = (data) => {
      const bytes = new Uint8Array(data);
      if (bytes.length < 7 || bytes[4] !== 0x01) return; // Wait for ACK
      const errorCode = bytes[5];
      if (errorCode === 0) {
        setResult({ display: `✓ Volume set to ${volume}`, success: true });
        setStatus('success');
      } else {
        setResult({ display: '✗ Failed', success: false });
        setStatus('error');
      }
      cleanup();
    };

    socket.on('serial-data', handleResponse);
    const cleanup = () => {
      socket.off('serial-data', handleResponse);
      clearTimeout(timer);
    };
  };

  return (
    <div className="bg-white rounded border border-gray-200 p-2 shadow-sm">
      <div className="flex items-center gap-1.5 mb-1">
        <Volume2 size={14} className="text-gray-500" />
        <h3 className="text-sm font-medium text-gray-700">Volume</h3>
      </div>
      <div className="flex gap-2 mb-2">
        <input
          type="range" min="0" max="100" value={volume}
          onChange={(e) => setVolume(parseInt(e.target.value))}
          disabled={!isConnected}
          className="flex-1"
        />
        <span className="text-sm font-mono w-8 text-center">{volume}</span>
      </div>
      {result && (
        <div className={"rounded px-2 py-1 mb-2 text-xs font-mono " + (result.success ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
          {result.display}
        </div>
      )}
      <button
        onClick={handleSet}
        disabled={!isConnected || status === 'pending'}
        className={"w-full py-1.5 px-3 rounded text-sm font-medium " + (isConnected && status !== 'pending' ? "bg-blue-500 hover:bg-blue-600 text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed")}
      >
        Set Volume
      </button>
    </div>
  );
};

/**
 * Channel list query card
 */
const GetChannelListCard = ({ isConnected }) => {
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);

  const handleGet = () => {
    if (!isConnected) return;
    setStatus('pending');
    setResult(null);

    const command = CommandBuilder.getChannelList();
    socket.emit('send-data', { data: command, type: 'hex' });

    const timer = setTimeout(() => {
      setStatus('timeout');
      setResult({ display: 'Timeout', success: false });
      cleanup();
    }, 5000);

    const handleResponse = (data) => {
      const parsed = parseChannelListResponse(data);
      setResult(parsed);
      setStatus(parsed.success ? 'success' : 'error');
      cleanup();
    };

    socket.on('serial-data', handleResponse);
    const cleanup = () => {
      socket.off('serial-data', handleResponse);
      clearTimeout(timer);
    };
  };

  return (
    <div className="bg-white rounded border border-gray-200 p-2 shadow-sm">
      <div className="flex items-center gap-1.5 mb-1">
        <Hash size={14} className="text-gray-500" />
        <h3 className="text-sm font-medium text-gray-700">Channel List</h3>
      </div>
      {result && (
        <div className={"rounded px-2 py-1 mb-2 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto " + (result.success ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
          {result.display}
        </div>
      )}
      <button
        onClick={handleGet}
        disabled={!isConnected || status === 'pending'}
        className={"w-full py-1.5 px-3 rounded text-sm font-medium " + (isConnected && status !== 'pending' ? "bg-blue-500 hover:bg-blue-600 text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed")}
      >
        Get Channels
      </button>
    </div>
  );
};

/**
 * Channel number set card (0x19)
 */
const SetChannelNumberCard = ({ isConnected }) => {
  const [channelNum, setChannelNum] = useState('');
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);

  const handleSet = () => {
    if (!isConnected || !channelNum) return;
    const num = parseInt(channelNum);
    if (isNaN(num) || num < 0) return;

    setStatus('pending');
    setResult(null);

    const command = CommandBuilder.setChannelNumber(num);
    socket.emit('send-data', { data: command, type: 'hex' });

    const timer = setTimeout(() => {
      setStatus('timeout');
      setResult({ display: 'Timeout', success: false });
      cleanup();
    }, 3000);

    const handleResponse = (data) => {
      const bytes = new Uint8Array(data);
      if (bytes.length < 7 || bytes[4] !== 0x01) return;
      const errorCode = bytes[5];
      if (errorCode === 0) {
        setResult({ display: `✓ Channel set to ${channelNum}`, success: true });
        setStatus('success');
      } else {
        setResult({ display: '✗ Failed', success: false });
        setStatus('error');
      }
      cleanup();
    };

    socket.on('serial-data', handleResponse);
    const cleanup = () => {
      socket.off('serial-data', handleResponse);
      clearTimeout(timer);
    };
  };

  return (
    <div className="bg-white rounded border border-gray-200 p-2 shadow-sm">
      <div className="flex items-center gap-1.5 mb-1">
        <Hash size={14} className="text-gray-500" />
        <h3 className="text-sm font-medium text-gray-700">Channel Number</h3>
      </div>
      <div className="flex gap-2 mb-2">
        <input
          type="number" value={channelNum}
          onChange={(e) => setChannelNum(e.target.value)}
          placeholder="Channel #"
          disabled={!isConnected}
          className={"flex-1 px-2 py-1.5 text-sm border rounded font-mono " + (isConnected ? "border-gray-300 focus:border-blue-500 focus:outline-none" : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed")}
        />
      </div>
      {result && (
        <div className={"rounded px-2 py-1 mb-2 text-xs font-mono " + (result.success ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
          {result.display}
        </div>
      )}
      <button
        onClick={handleSet}
        disabled={!isConnected || !channelNum || status === 'pending'}
        className={"w-full py-1.5 px-3 rounded text-sm font-medium " + (isConnected && channelNum && status !== 'pending' ? "bg-blue-500 hover:bg-blue-600 text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed")}
      >
        Set Channel
      </button>
    </div>
  );
};
