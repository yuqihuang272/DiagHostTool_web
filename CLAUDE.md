# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

comtest 是一个基于 Web 的串口调试工具，用于替代传统桌面串口终端。通过现代 Web 界面实现日志查看、ASCII/HEX 数据收发和串口连接管理。

## 常用命令

```bash
# 开发模式（同时启动前后端，推荐）
npm run dev

# 仅启动后端服务器（端口 3000）
npm run server

# 仅启动前端开发服务器（端口 5173）
npm run client

# 构建前端到 client/dist
npm run build

# 前端代码检查
cd client && npm run lint
```

## 架构

```
comtest/
├── server/           # Node.js 后端
│   └── index.js      # Express + Socket.IO + SerialPort 主入口
├── client/           # React 前端 (Vite)
│   └── src/
│       ├── App.jsx           # 主应用组件
│       ├── socket.js         # Socket.IO 客户端实例
│       └── components/       # UI 组件 (Sidebar, LogViewer, CommandPanel)
└── package.json      # 根配置，管理 concurrently 脚本
```

**通信流程**: 前端 React 通过 Socket.IO 连接后端，后端通过 SerialPort 库访问物理串口，数据以 WebSocket 实时双向传输。

## Socket.IO 事件协议

| 方向 | 事件 | 说明 |
|------|------|------|
| Client → Server | `list-ports` | 请求可用串口列表 |
| Client → Server | `open-port` | 打开串口（含 baudRate, dataBits, stopBits, parity, flowControl） |
| Client → Server | `close-port` | 关闭当前串口 |
| Client → Server | `send-data` | 发送数据 `{ type: 'ascii'|'hex', data: ... }` |
| Server → Client | `ports-list` | 返回可用串口数组 |
| Server → Client | `serial-data` | 串口原始二进制数据流 |
| Server → Client | `port-opened` / `port-closed` | 状态更新 |
| Server → Client | `port-error` | 错误消息 |

## 技术栈

- **后端**: Express, Socket.IO, SerialPort, CORS
- **前端**: React 18, Vite, Tailwind CSS, Socket.IO Client, Lucide React
- **开发工具**: concurrently, nodemon, ESLint

## 开发注意事项

- 后端实现了优雅关闭（SIGINT, SIGTERM, SIGUSR2），确保串口正确释放
- 前端支持键盘直接输入发送字符（终端风格）
- 快捷命令支持 HEX 字符串格式如 `01 03 FF`
