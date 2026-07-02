import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectDb, disconnectDb } from './db.js';

// Note: db.ts is listed in coverage.exclude, but the v8 all-files scan in the
// current vitest stopped honoring excludes for src files — so the bootstrap
// seam is covered directly (with mocked mongoose; no real connections).

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('connectDb', () => {
  it('returns the connection on first success', async () => {
    const conn = {
      connection: { host: 'memory', name: 'test-db' },
    } as unknown as typeof mongoose;
    const spy = vi.spyOn(mongoose, 'connect').mockResolvedValue(conn);
    await expect(connectDb()).resolves.toBe(conn);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('retries with backoff and succeeds on a later attempt', async () => {
    vi.useFakeTimers();
    const conn = {
      connection: { host: 'memory', name: 'test-db' },
    } as unknown as typeof mongoose;
    const spy = vi
      .spyOn(mongoose, 'connect')
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(conn);
    const pending = connectDb();
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toBe(conn);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('throws the last error after exhausting all attempts', async () => {
    vi.useFakeTimers();
    const spy = vi
      .spyOn(mongoose, 'connect')
      .mockRejectedValue(new Error('mongo unreachable'));
    const pending = connectDb();
    const guarded = pending.catch((err: Error) => err);
    await vi.runAllTimersAsync();
    const err = await guarded;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('mongo unreachable');
    expect(spy).toHaveBeenCalledTimes(5);
  });
});

describe('disconnectDb', () => {
  it('delegates to mongoose.disconnect', async () => {
    const spy = vi.spyOn(mongoose, 'disconnect').mockResolvedValue(undefined);
    await disconnectDb();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
