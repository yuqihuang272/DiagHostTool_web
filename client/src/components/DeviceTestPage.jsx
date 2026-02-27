import React from 'react';
import { TestCommandCard } from './TestCommandCard';
import { Cpu } from 'lucide-react';
import { COMMANDS, buildSetSourceCommand, PROTOCOL } from '../utils/cvteProtocol';
import {
  parseChecksumResponse,
  parseIpResponse,
  parseWifiResponse,
  parseBluetoothResponse,
  parseMacResponse,
  parseSetSourceResponse,
} from '../utils/responseParsers';

/**
 * Device Test Page - Contains all device testing functions
 * Each function is represented as a TestCommandCard
 *
 * Based on CVTE Factory Auto Test Serial Communication Protocol v2.1.51
 */
export const DeviceTestPage = ({ isConnected }) => {
  // Command configurations based on CVTE protocol
  const commands = [
    {
      id: 'checksum',
      title: 'Get Checksum',
      description: 'Get device firmware checksum',
      command: COMMANDS.GET_CHECKSUM,
      timeout: 3000,
      enabled: true,
      parseResponse: parseChecksumResponse,
    },
    {
      id: 'ip',
      title: 'Get IP Address',
      description: 'Read device current IP address',
      command: COMMANDS.GET_IP,
      timeout: 3000,
      enabled: true,
      parseResponse: parseIpResponse,
    },
    {
      id: 'wifi',
      title: 'WiFi Test',
      description: 'Check WiFi module status',
      command: COMMANDS.GET_WIFI_STATUS,
      timeout: 5000,
      enabled: true,
      parseResponse: parseWifiResponse,
    },
    {
      id: 'bluetooth',
      title: 'Bluetooth Test',
      description: 'Check Bluetooth module status',
      command: COMMANDS.GET_BLUETOOTH_STATUS,
      timeout: 5000,
      enabled: true,
      parseResponse: parseBluetoothResponse,
    },
    {
      id: 'mac',
      title: 'Get MAC Address',
      description: 'Read device network MAC address',
      command: COMMANDS.GET_MAC_ADDR,
      timeout: 3000,
      enabled: true,
      parseResponse: parseMacResponse,
    },
    {
      id: 'atv',
      title: 'Switch to ATV',
      description: 'Switch to analog TV source',
      command: COMMANDS.SET_ATV,
      timeout: 3000,
      enabled: true,
      parseResponse: (data) => parseSetSourceResponse(data, 'ATV'),
    },
    {
      id: 'dtv',
      title: 'Switch to DTV',
      description: 'Switch to digital TV source',
      command: COMMANDS.SET_DTV,
      timeout: 3000,
      enabled: true,
      parseResponse: (data) => parseSetSourceResponse(data, 'DTV'),
    },
    {
      id: 'hdmi1',
      title: 'Switch to HDMI1',
      description: 'Switch to HDMI1 input',
      command: COMMANDS.SET_HDMI1,
      timeout: 3000,
      enabled: true,
      parseResponse: (data) => parseSetSourceResponse(data, 'HDMI1'),
    },
    {
      id: 'hdmi2',
      title: 'Switch to HDMI2',
      description: 'Switch to HDMI2 input',
      command: COMMANDS.SET_HDMI2,
      timeout: 3000,
      enabled: true,
      parseResponse: (data) => parseSetSourceResponse(data, 'HDMI2'),
    },
  ];

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
      {/* Page Header */}
      <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
        <Cpu size={24} className="text-blue-500" />
        <h1 className="text-xl font-semibold text-gray-800">Device Test</h1>
        <span className={`ml-auto px-2 py-1 rounded text-sm ${isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Protocol Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">
        <strong>Protocol:</strong> CVTE Factory Auto Test v2.1.51 |
        <strong className="ml-2">Baud Rate:</strong> 115200 |
        <strong className="ml-2">Format:</strong> 8N1
      </div>

      {/* Command Cards Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {commands.map((cmd) => (
            <TestCommandCard
              key={cmd.id}
              title={cmd.title}
              description={cmd.description}
              command={cmd.command}
              timeout={cmd.timeout}
              enabled={cmd.enabled}
              parseResponse={cmd.parseResponse}
              isConnected={isConnected}
            />
          ))}
        </div>
      </div>

      {/* Footer hint */}
      <div className="text-xs text-gray-400 text-center pt-2 border-t border-gray-200">
        Click "Execute" to send command. Results will be displayed in human-readable format.
      </div>
    </div>
  );
};
