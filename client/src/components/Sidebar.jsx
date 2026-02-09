import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
import { RefreshCw, Power, Terminal, Cpu } from 'lucide-react';
import { clsx } from 'clsx';

export const Sidebar = ({ isConnected, currentPage, onPageChange }) => {
  const [ports, setPorts] = useState([]);
  const [config, setConfig] = useState({
    path: '',
    baudRate: '115200',
    // 默认隐藏参数，保持标准配置
    dataBits: '8',
    parity: 'none',
    stopBits: '1',
    flowControl: 'none'
  });

  const refreshPorts = () => {
    socket.emit('list-ports');
  };

  useEffect(() => {
    socket.on('ports-list', (list) => {
      setPorts(list);
      if (list.length > 0 && !config.path) {
        setConfig(prev => ({ ...prev, path: list[0].path }));
      }
    });

    refreshPorts();

    return () => {
      socket.off('ports-list');
    };
  }, []);

  const handleChange = (e) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const toggleConnection = () => {
    if (isConnected) {
      socket.emit('close-port');
    } else {
      socket.emit('open-port', config);
    }
  };

  return (
    <div className="w-80 bg-gray-50 border-r border-gray-200 p-4 flex flex-col h-full overflow-y-auto">
      {/* Page Tabs */}
      <div className="flex mb-4 bg-gray-200 rounded-lg p-1">
        <button
          onClick={() => onPageChange('terminal')}
          className={clsx(
            "flex-1 py-2 px-3 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition",
            currentPage === 'terminal'
              ? "bg-white text-gray-800 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Terminal size={16} />
          终端
        </button>
        <button
          onClick={() => onPageChange('device-test')}
          className={clsx(
            "flex-1 py-2 px-3 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition",
            currentPage === 'device-test'
              ? "bg-white text-gray-800 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Cpu size={16} />
          设备测试
        </button>
      </div>

      <h2 className="text-lg font-semibold mb-4 text-gray-700">连接设置</h2>
      
      <div className="space-y-4">
        {/* Port Selection */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">串口号 (Port)</label>
          <div className="flex gap-2">
            <select 
              name="path" 
              value={config.path} 
              onChange={handleChange}
              disabled={isConnected}
              className="flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
            >
              {ports.length === 0 && <option value="">未检测到串口</option>}
              {ports.map((p) => (
                <option key={p.path} value={p.path}>{p.path} {p.manufacturer ? `(${p.manufacturer})` : ''}</option>
              ))}
            </select>
            <button 
              onClick={refreshPorts}
              disabled={isConnected}
              className="p-2 bg-gray-200 rounded hover:bg-gray-300 transition disabled:opacity-50"
              title="刷新列表"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Baud Rate */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">波特率 (Baud Rate)</label>
          <select 
            name="baudRate" 
            value={config.baudRate} 
            onChange={handleChange}
            disabled={isConnected}
            className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
          >
            <option value="115200">115200</option>
            <option value="9600">9600</option>
          </select>
        </div>

        {/* Connection Toggle Button */}
        <div className="pt-4">
            <button
            onClick={toggleConnection}
            className={clsx(
                "w-full py-2.5 px-4 rounded text-white font-medium flex items-center justify-center gap-2 transition shadow-sm",
                isConnected ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"
            )}
            >
            <Power size={18} />
            {isConnected ? "关闭串口" : "打开串口"}
            </button>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-xs text-gray-400">
                默认配置: 8 Data Bits, None Parity, 1 Stop Bit, No Flow Control
            </p>
        </div>

      </div>
    </div>
  );
};