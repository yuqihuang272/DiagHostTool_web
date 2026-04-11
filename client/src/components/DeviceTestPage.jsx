import React, { useState } from 'react';
import { CompactCommandCard } from './CompactCommandCard';
import { SourceSelector, GetCurrentSource } from './SourceSelector';
import { Cpu, Info, TestTube, Tv } from 'lucide-react';
import { COMMANDS } from '../utils/cvteProtocol';
import {
  parseChecksumResponse,
  parseIpResponse,
  parseWifiResponse,
  parseBluetoothResponse,
  parseMacResponse,
} from '../utils/responseParsers';
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

  const tabs = [
    { id: 'info', label: 'Info Query', labelCN: '信息查询', icon: Info },
    { id: 'test', label: 'Module Test', labelCN: '模块测试', icon: TestTube },
    { id: 'source', label: 'Source Control', labelCN: '信源控制', icon: Tv },
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
