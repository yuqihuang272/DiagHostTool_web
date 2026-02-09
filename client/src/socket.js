import { io } from "socket.io-client";

const URL = import.meta.env.DEV ? "http://localhost:3000" : undefined;

export const socket = io(URL, {
    autoConnect: true
});