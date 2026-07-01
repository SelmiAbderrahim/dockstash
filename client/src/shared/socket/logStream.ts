import { io, type Socket } from 'socket.io-client';
import { loadCookie } from '@shared/utils/cookies';

const SOCKET_URL: string = import.meta.env.VITE_SOCKET_URL ?? '/';
const NAMESPACE = '/scheduler';

export interface LogLine {
  jobId: string;
  line: string;
}

export interface LogDone {
  jobId: string;
  ok: boolean;
  detail?: string;
}

export interface LogStreamHandlers {
  onLog?: (line: LogLine) => void;
  onDone?: (done: LogDone) => void;
  onError?: (message: string) => void;
}

export interface LogStreamHandle {
  disconnect(): void;
}

/**
 * Subscribe to the `/scheduler` namespace log stream for a specific `jobId`.
 * Auth token is pulled from the same `token` cookie the REST client uses so
 * the JWT middleware on the server accepts the handshake.
 *
 * Returns a handle whose `disconnect()` must be called on unmount.
 */
export function subscribeToJobLogs(
  jobId: string,
  handlers: LogStreamHandlers,
  createSocket: (url: string, opts: Record<string, unknown>) => Socket = io as unknown as (
    url: string,
    opts: Record<string, unknown>,
  ) => Socket,
): LogStreamHandle {
  const token = loadCookie<string>('token') ?? '';
  const socket = createSocket(`${SOCKET_URL}${NAMESPACE}`, {
    auth: { token: token.replace(/^JWT\s+/i, '') },
    transports: ['websocket', 'polling'],
    reconnection: true,
  });

  socket.on('connect', () => {
    socket.emit('join', { jobId }, (resp: { ok: boolean; reason?: string }) => {
      if (!resp?.ok) handlers.onError?.(resp?.reason ?? 'join_failed');
    });
  });
  socket.on('log', (payload: LogLine) => handlers.onLog?.(payload));
  socket.on('done', (payload: LogDone) => handlers.onDone?.({ ...payload, ok: true }));
  socket.on('failed', (payload: LogDone) => handlers.onDone?.({ ...payload, ok: false }));
  socket.on('connect_error', (err: Error) => handlers.onError?.(err.message));

  return {
    disconnect() {
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}
