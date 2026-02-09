import React from 'react';
import { TestCommandCard } from './TestCommandCard';
import { Cpu } from 'lucide-react';

/**
 * Protocol format:
 * [0] FF - Frame header
 * [1] 33 - Device identifier
 * [2] XX - Total packet length
 * [3] 03 - Command type
 * [4] XX - Response command ID (request ID + 1)
 * [5..n-1] - Payload data (ASCII encoded)
 * [n] XX - Checksum
 */

/**
 * Extract payload from protocol response and convert to ASCII string
 * @param {ArrayBuffer} data - Raw response data
 * @returns {string} Parsed ASCII string
 */
const parseAsciiPayload = (data) => {
  const bytes = new Uint8Array(data);
  // Payload starts at index 5, ends before last byte (checksum)
  const payload = bytes.slice(5, bytes.length - 1);
  // Convert ASCII bytes to string
  return String.fromCharCode(...payload);
};

/**
 * Extract payload and return as HEX string (for non-ASCII data)
 * @param {ArrayBuffer} data - Raw response data
 * @returns {string} HEX string of payload
 */
const parseHexPayload = (data) => {
  const bytes = new Uint8Array(data);
  const payload = bytes.slice(5, bytes.length - 1);
  return Array.from(payload)
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
};

/**
 * Return full raw response as HEX string (for debugging)
 * @param {ArrayBuffer} data - Raw response data
 * @returns {string} Full HEX string
 */
const parseRawHex = (data) => {
  const bytes = new Uint8Array(data);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
};

/**
 * Device Test Page - Contains all device testing functions
 * Each function is represented as a TestCommandCard
 */
export const DeviceTestPage = ({ isConnected }) => {
  // Command configurations - easy to extend
  const commands = [
    {
      id: 'checksum',
      title: '获取 Checksum',
      description: '获取设备固件校验码',
      command: 'FF 33 06 03 12 E5',
      timeout: 3000,
      enabled: true,
      parseResponse: parseAsciiPayload,
    },
    {
      id: 'ip',
      title: '获取 IP 地址',
      description: '读取设备当前 IP 地址',
      command: 'FF 33 06 03 31 C6',
      timeout: 3000,
      enabled: true,
      parseResponse: parseAsciiPayload,
    },
    {
      id: 'wifi',
      title: 'WiFi 测试',
      description: '获取 WiFi 功能测试结果',
      command: 'FF 33 06 03 31 C6',
      timeout: 5000,
      enabled: true,
      parseResponse: parseAsciiPayload,
    },
    {
      id: 'atv',
      title: '切换 ATV',
      description: '切换到模拟电视信号源',
      command: 'FF 33 07 03 16 0F D1',
      timeout: 3000,
      enabled: true,
      parseResponse: parseHexPayload,
    },
    {
      id: 'dtv',
      title: '切换 DTV',
      description: '切换到数字电视信号源',
      command: 'XX XX XX',
      timeout: 3000,
      enabled: false, // Not implemented yet
    },
    {
      id: 'mac',
      title: '获取 MAC 地址',
      description: '读取设备网络 MAC 地址',
      command: 'XX XX XX',
      timeout: 3000,
      enabled: false, // Not implemented yet
    },
    {
      id: 'bt',
      title: '蓝牙测试',
      description: '执行蓝牙功能测试',
      command: 'XX XX XX',
      timeout: 5000,
      enabled: false, // Not implemented yet
    },
  ];

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
      {/* Page Header */}
      <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
        <Cpu size={24} className="text-blue-500" />
        <h1 className="text-xl font-semibold text-gray-800">设备测试</h1>
        <span className={`ml-auto px-2 py-1 rounded text-sm ${isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {isConnected ? '已连接' : '未连接'}
        </span>
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
        灰色卡片表示功能待实现，后续可通过添加命令配置扩展
      </div>
    </div>
  );
};
