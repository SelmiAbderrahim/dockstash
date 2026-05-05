import { io, type Socket } from 'socket.io-client';

const SOCKET_URL: string = import.meta.env.VITE_SOCKET_URL ?? '/';

let cached: Socket | null = null;

export const getSocket = (): Socket => {
  if (cached === null) {
    cached = io(SOCKET_URL, { autoConnect: true });
  }
  return cached;
};
