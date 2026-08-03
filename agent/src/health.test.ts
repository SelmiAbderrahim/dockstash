import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { startHealthServer, type HealthStatus } from './health.js';

describe('startHealthServer', () => {
  let server: ReturnType<typeof startHealthServer>;
  let baseUrl: string;

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  function boot(status: () => HealthStatus): void {
    server = startHealthServer(0, status);
  }

  it('GET /healthz reports null heartbeat/job status before any job has run', async () => {
    boot(() => ({ runningJobId: null, lastHeartbeatAt: null }));
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; lastHeartbeatAt: string | null; runningJobId: string | null };
    expect(body).toEqual({ ok: true, lastHeartbeatAt: null, runningJobId: null });
  });

  it('GET /healthz reports the current job id and heartbeat timestamp', async () => {
    const at = new Date('2026-07-01T12:00:00.000Z');
    boot(() => ({ runningJobId: 'job-9', lastHeartbeatAt: at }));
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; lastHeartbeatAt: string | null; runningJobId: string | null };
    expect(body).toEqual({ ok: true, lastHeartbeatAt: at.toISOString(), runningJobId: 'job-9' });
  });

  it('returns 404 for any other path', async () => {
    boot(() => ({ runningJobId: null, lastHeartbeatAt: null }));
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
    const res = await fetch(`${baseUrl}/not-a-real-path`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { ok: boolean };
    expect(body).toEqual({ ok: false });
  });
});
