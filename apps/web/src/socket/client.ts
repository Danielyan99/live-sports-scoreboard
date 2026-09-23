import { SOCKET_NAMESPACE, type ClientToServerEvents, type ServerToClientEvents } from '@scoreboard/shared';
import { io, type Socket } from 'socket.io-client';

export const SERVER_URL = (import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export type LiveSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** One shared connection for the whole app. Socket.io handles reconnect with backoff. */
export const socket: LiveSocket = io(`${SERVER_URL}${SOCKET_NAMESPACE}`, {
  autoConnect: false,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
});
