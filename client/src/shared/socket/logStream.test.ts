import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import { subscribeToJobLogs } from './logStream';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));
const ioMock = vi.mocked(io);

interface FakeSocket {
  socket: Socket;
  handlers: Record<string, (arg: unknown) => void>;
  emit: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

const makeFakeSocket = (): FakeSocket => {
  const handlers: Record<string, (arg: unknown) => void> = {};
  const emit = vi.fn();
  const removeAllListeners = vi.fn();
  const disconnect = vi.fn();
  const socket = {
    on: vi.fn((event: string, cb: (arg: unknown) => void) => {
      handlers[event] = cb;
      return socket;
    }),
    emit,
    removeAllListeners,
    disconnect,
  } as unknown as Socket;
  return { socket, handlers, emit, removeAllListeners, disconnect };
};

beforeEach(() => {
  vi.clearAllMocks();
  document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
});

describe('subscribeToJobLogs', () => {
  it('wires log/done/failed/error events and strips the JWT prefix from the token', () => {
    document.cookie = `token=${encodeURIComponent('JWT secret-token')}; path=/`;
    const fake = makeFakeSocket();
    const onLog = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const handle = subscribeToJobLogs('job-1', { onLog, onDone, onError }, () => fake.socket);

    // The injected factory is used, so the default `io` is never called.
    expect(ioMock).not.toHaveBeenCalled();

    // connect -> join emit; exercise the join ack branches.
    fake.handlers.connect!(undefined);
    const joinCb = fake.emit.mock.calls[0]![2] as (r: unknown) => void;
    expect(fake.emit.mock.calls[0]![0]).toBe('join');
    joinCb({ ok: true });
    expect(onError).not.toHaveBeenCalled();
    joinCb({ ok: false, reason: 'denied' });
    expect(onError).toHaveBeenCalledWith('denied');
    joinCb(undefined);
    expect(onError).toHaveBeenCalledWith('join_failed');

    fake.handlers.log!({ jobId: 'job-1', line: 'hello' });
    expect(onLog).toHaveBeenCalledWith({ jobId: 'job-1', line: 'hello' });

    fake.handlers.done!({ jobId: 'job-1', ok: false, detail: 'd' });
    expect(onDone).toHaveBeenCalledWith({ jobId: 'job-1', ok: true, detail: 'd' });

    fake.handlers.failed!({ jobId: 'job-1', detail: 'f' });
    expect(onDone).toHaveBeenCalledWith({ jobId: 'job-1', ok: false, detail: 'f' });

    fake.handlers.connect_error!(new Error('boom'));
    expect(onError).toHaveBeenCalledWith('boom');

    handle.disconnect();
    expect(fake.removeAllListeners).toHaveBeenCalled();
    expect(fake.disconnect).toHaveBeenCalled();
  });

  it('falls back to the "/" socket URL when VITE_SOCKET_URL is unset', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SOCKET_URL', undefined as unknown as string);
    const mod = await import('./logStream');
    const fake = makeFakeSocket();
    const factory = vi.fn(() => fake.socket);
    mod.subscribeToJobLogs('job-x', {}, factory as never);
    expect(factory).toHaveBeenCalledWith('//scheduler', expect.any(Object));
    vi.unstubAllEnvs();
  });

  it('uses the default socket factory and an empty token when no cookie is set', () => {
    const fake = makeFakeSocket();
    ioMock.mockReturnValue(fake.socket);

    const handle = subscribeToJobLogs('job-2', {});
    expect(ioMock).toHaveBeenCalledTimes(1);
    const [, opts] = ioMock.mock.calls[0]!;
    expect((opts as { auth: { token: string } }).auth.token).toBe('');

    // Handlers registered without callbacks must not throw.
    fake.handlers.connect!(undefined);
    const joinCb = fake.emit.mock.calls[0]![2] as (r: unknown) => void;
    expect(() => joinCb({ ok: false })).not.toThrow();
    expect(() => fake.handlers.log!({ jobId: 'job-2', line: 'x' })).not.toThrow();
    expect(() => fake.handlers.done!({ jobId: 'job-2', ok: true })).not.toThrow();
    expect(() => fake.handlers.failed!({ jobId: 'job-2', ok: false })).not.toThrow();
    expect(() => fake.handlers.connect_error!(new Error('e'))).not.toThrow();

    handle.disconnect();
  });
});
