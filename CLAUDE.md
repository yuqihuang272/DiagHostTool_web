# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

comtest 是一个基于 Web 的串口调试工具，用于替代传统桌面串口终端。通过现代 Web 界面实现日志查看、ASCII/HEX 数据收发和串口连接管理。同时提供命令行工具（CLI）用于自动化测试场景。

## 初始化

```bash
# 安装所有依赖（使用 workspaces 管理多包）
npm install
```

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

# CLI 工具
node cli/index.js --help
node cli/index.js list-ports
node cli/index.js -p /dev/ttyUSB0 get checksum
```

## 架构

```
comtest/
├── shared/           # 共享协议模块
│   └── cvteProtocol.js   # CVTE 工厂测试协议（CLI 和 WebUI 共用）
├── cli/              # 命令行工具
│   ├── index.js          # CLI 入口
│   ├── serialClient.js   # 串口通信封装
│   └── commands.js       # 命令处理器
├── server/           # Node.js 后端
│   └── index.js      # Express + Socket.IO + SerialPort 主入口
├── client/           # React 前端 (Vite)
│   └── src/
│       ├── App.jsx           # 主应用组件
│       ├── socket.js         # Socket.IO 客户端实例
│       └── components/       # UI 组件 (Sidebar, LogViewer, CommandPanel)
└── package.json      # 根配置，管理 workspaces 和 concurrently 脚本
```

**通信流程**: 前端 React 通过 Socket.IO 连接后端，后端通过 SerialPort 库访问物理串口，数据以 WebSocket 实时双向传输。

## 架构决策

### WebUI 与 CLI 的关系

WebUI 和 CLI **各自独立调用串口**，通过 `shared/cvteProtocol.js` 共享协议逻辑。

**为什么不采用"WebUI 调用 CLI"的方案？**

| 维度   | 当前方案（独立调用） | WebUI 调用 CLI |
| ---- | ---------- | ------------ |
| 性能   | ✅ 内存直接通信   | ❌ 每次需启动子进程   |
| 实时日志 | ✅ 直接推送数据流  | ❌ 需额外处理子进程输出 |
| 调试   | ✅ 单进程调试    | ❌ 多进程调试复杂    |
| 串口独占 | ⚠️ 两边不能同时用 | ⚠️ 同样不能同时用   |

**关键结论**：串口独占是物理限制，无法通过架构解决。当前方案在性能、实时性和调试便利性方面更优。

### 添加新协议命令

1. 在 `shared/cvteProtocol.js` 中添加命令构建器和响应解析器
2. 在 `cli/commands.js` 的 `COMMAND_MAP` 中注册命令
3. WebUI 如需使用，在 `DeviceTestPage.jsx` 中添加命令卡片

## Socket.IO 事件协议

| 方向              | 事件                            | 说明                                                        |
| --------------- | ----------------------------- | --------------------------------------------------------- |
| Client → Server | `list-ports`                  | 请求可用串口列表                                                  |
| Client → Server | `open-port`                   | 打开串口（含 baudRate, dataBits, stopBits, parity, flowControl） |
| Client → Server | `close-port`                  | 关闭当前串口                                                    |
| Client → Server | `send-data`                   | 发送数据 `{ type: 'ascii'                                     |
| Server → Client | `ports-list`                  | 返回可用串口数组                                                  |
| Server → Client | `serial-data`                 | 串口原始二进制数据流                                                |
| Server → Client | `port-opened` / `port-closed` | 状态更新                                                      |
| Server → Client | `port-error`                  | 错误消息                                                      |

## 技术栈

- **后端**: Express, Socket.IO, SerialPort, CORS
- **前端**: React 18, Vite, Tailwind CSS, Socket.IO Client, Lucide React
- **开发工具**: concurrently, nodemon, ESLint

## 页面结构

- **Terminal 页面** (`currentPage === 'terminal'`): 串口终端，日志查看 + 命令发送
- **Device Test 页面** (`currentPage === 'device-test'`): 设备测试功能，预定义命令卡片

## 设备通信协议

DeviceTestPage 使用自定义协议格式：

```
[0] FF       - Frame header
[1] 33       - Device identifier
[2] XX       - Total packet length
[3] 03       - Command type
[4] XX       - Response command ID (request ID + 1)
[5..n-1]     - Payload data (ASCII encoded)
[n] XX       - Checksum
```

添加新测试命令只需在 `DeviceTestPage.jsx` 的 `commands` 数组中添加配置项。

## 开发注意事项

- 后端实现了优雅关闭（SIGINT, SIGTERM, SIGUSR2），确保串口正确释放
- 前端支持键盘直接输入发送字符（终端风格）
- 快捷命令支持 HEX 字符串格式如 `01 03 FF`
- 日志合并逻辑：同类（rx/tx）且上一条未以换行符结尾时合并显示

## CLI 命令行工具

### 使用方式

```bash
# 列出可用串口
node cli/index.js list-ports

# 获取设备信息
node cli/index.js -p /dev/ttyUSB0 get checksum
node cli/index.js -p COM3 get ip
node cli/index.js -p /dev/ttyUSB0 get mac

# 设置命令
node cli/index.js -p /dev/ttyUSB0 set source atv
node cli/index.js -p COM3 set source hdmi1

# 测试命令
node cli/index.js -p /dev/ttyUSB0 test wifi
node cli/index.js -p /dev/ttyUSB0 test bluetooth

# JSON 输出（用于脚本集成）
node cli/index.js -p /dev/ttyUSB0 get ip --json

# 全局选项
node cli/index.js -p /dev/ttyUSB0 -b 115200 -t 5000 get checksum


# 具体例子
huangyuqi@YuqideMacBook-Pro-1096 comtest % node cli/index.js -p  /dev/tty.usbserial-gggggggg1 get checksum 
✓ Checksum: 20260223_060853
huangyuqi@YuqideMacBook-Pro-1096 comtest % node cli/index.js -p  /dev/tty.usbserial-gggggggg1 get ip       
✓ IP Address: 0.0.0.0
huangyuqi@YuqideMacBook-Pro-1096 comtest % node cli/index.js -p  /dev/tty.usbserial-gggggggg1 get mac
✓ MAC Address: 8C:7A:B3:67:0B:B3
huangyuqi@YuqideMacBook-Pro-1096 comtest % node cli/index.js -p  /dev/tty.usbserial-gggggggg1 set source atv
✗ Error: Unknown command: get set
huangyuqi@YuqideMacBook-Pro-1096 comtest % node cli/index.js -p  /dev/tty.usbserial-gggggggg1 set source atv 
✓ source set to atv
huangyuqi@YuqideMacBook-Pro-1096 comtest % node cli/index.js -p  /dev/tty.usbserial-gggggggg1 set source hdmi1
✓ source set to hdmi1
huangyuqi@YuqideMacBook-Pro-1096 comtest % 
huangyuqi@YuqideMacBook-Pro-1096 comtest % node cli/index.js -p  /dev/tty.usbserial-gggggggg1 set source hdmi3
✓ source set to hdmi3
huangyuqi@YuqideMacBook-Pro-1096 comtest % node cli/index.js -p  /dev/tty.usbserial-gggggggg1 get ip            
✓ IP Address: 0.0.0.0
huangyuqi@YuqideMacBook-Pro-1096 comtest % node cli/index.js -p  /dev/tty.usbserial-gggggggg1 get ip --json
{
  "success": true,
  "ip": "0.0.0.0"
}
huangyuqi@YuqideMacBook-Pro-1096 comtest % node cli/index.js -p  /dev/tty.usbserial-gggggggg1 test wifi         
✓ WiFi Test: Normal
huangyuqi@YuqideMacBook-Pro-1096 comtest % node cli/index.js -p  /dev/tty.usbserial-gggggggg1 get wifi 
✓ WiFi Status: Normal
huangyuqi@YuqideMacBook-Pro-1096 comtest % node cli/index.js -p  /dev/tty.usbserial-gggggggg1 get wifi --json
{
  "success": true,
  "status": "Normal",
  "statusCode": 0
}
```

### CLI 命令列表

| 类别   | 命令                  | 说明                                               |
| ---- | ------------------- | ------------------------------------------------ |
| 端口管理 | `list-ports`        | 列出可用串口                                           |
| 获取信息 | `get checksum`      | 获取固件校验码                                          |
|      | `get ip`            | 获取 IP 地址                                         |
|      | `get mac`           | 获取 MAC 地址                                        |
|      | `get source`        | 获取当前信源                                           |
|      | `get wifi`          | 获取 WiFi 状态                                       |
|      | `get bluetooth`     | 获取蓝牙状态                                           |
| 设置命令 | `set source <name>` | 切换信源 (atv/dtv/hdmi1/hdmi2/vga/av1/av2/usb1/usb2) |
| 测试命令 | `test wifi`         | WiFi 测试                                          |
|      | `test bluetooth`    | 蓝牙测试                                             |

### 全局选项

| 选项                   | 说明        | 默认值    |
| -------------------- | --------- | ------ |
| `-p, --port <path>`  | 串口路径      | -      |
| `-b, --baud <rate>`  | 波特率       | 115200 |
| `-t, --timeout <ms>` | 响应超时      | 3000   |
| `-j, --json`         | JSON 格式输出 | false  |
