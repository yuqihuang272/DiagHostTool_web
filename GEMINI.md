# Project Overview

**Project Name:** comtest (Web-based Serial Port Debugger)

This project is a web-based serial port communication tool designed to replace traditional desktop serial terminals. It allows users to view logs, send ASCII/HEX data, and manage serial connections through a modern web interface.

## Tech Stack

*   **Runtime:** Node.js
*   **Backend:** Express, Socket.IO, SerialPort
*   **Frontend:** React (Vite), Tailwind CSS, Socket.IO Client
*   **Architecture:** Client-Server model. The Node.js server handles the physical serial port access and streams data via WebSockets to the React frontend.

## Directory Structure

*   **`client/`**: React frontend source code.
    *   `src/components/`: UI components (`Sidebar`, `LogViewer`, `CommandPanel`).
    *   `src/socket.js`: Socket.IO client instance.
*   **`server/`**: Node.js backend source code.
    *   `index.js`: Main server entry point. Handles Express setup, Socket.IO events, and SerialPort management.
*   **`package.json`**: Root configuration for managing concurrent scripts.

# Building and Running

## Prerequisites

*   Node.js (v18+ recommended)
*   npm

## Key Commands

The project uses `concurrently` to manage both frontend and backend during development.

| Command | Description |
| :--- | :--- |
| **`npm run dev`** | **Primary Dev Command.** Starts both the backend server (port 3000) and the React dev server (port 5173) with hot-reloading. |
| `npm run build` | Builds the React frontend into static files in `client/dist`. |
| `npm run server` | Starts only the backend server. If built, it serves the frontend at `http://localhost:3000`. |

## Usage Guide

1.  **Connect:** Use the sidebar to select a serial port and baud rate (115200 or 9600).
2.  **Monitor:** View incoming data in the central log panel. Toggle between ASCII and HEX views.
3.  **Interact:**
    *   **Keyboard:** Click the log panel to focus. Typing sends characters directly (terminal style).
    *   **Quick Commands:** Use the bottom panel to create and send preset macros (supports HEX strings like `01 03 FF`).

# Development Conventions

## Communication Protocol (Socket.IO)

The frontend and backend communicate via specific socket events:

*   **Client -> Server:**
    *   `list-ports`: Request available serial ports.
    *   `open-port`: Request to open a connection with specific config.
    *   `close-port`: Request to close the current connection.
    *   `send-data`: Send data payload `{ type: 'ascii'|'hex', data: ... }`.
*   **Server -> Client:**
    *   `ports-list`: Returns array of available ports.
    *   `serial-data`: Stream of raw binary data from the device.
    *   `port-opened` / `port-closed`: Status updates.
    *   `port-error`: Error messages.

## Code Style

*   **Frontend:** Functional React components with Hooks. Styling via Tailwind CSS utility classes.
*   **Backend:** Event-driven architecture using `socket.on` handlers.
*   **Shutdown:** The server implements graceful shutdown (handling `SIGINT`, `SIGTERM`) to ensure serial ports are released correctly.
