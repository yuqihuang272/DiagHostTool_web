import { io } from "socket.io-client";

// Connect to the backend at :3000 when running under the Vite dev server
// (:5173). In production the frontend is served by the backend itself
// (same-origin), so use undefined to connect to the current host.
// NOTE: import.meta.env.DEV can be false inside Vite's pre-bundled deps, so
// detect dev mode by checking whether we are NOT on port 3000.
const isDev = location.port !== '3000';
const URL = isDev ? "http://localhost:3000" : undefined;

export const socket = io(URL, {
    autoConnect: true
});