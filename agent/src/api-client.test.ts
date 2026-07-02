import { describe, expect, it } from 'vitest';
import { AgentApiClient, ApiError, type FetchFn } from './api-client.js';
import type { ClaimedJob, HeartbeatResponse } from './types.js';

function fakeFetch(
  responses: Array<{ status: number; json?: unknown; text?: string }>,
): { fn: FetchFn; calls: Array<{ url: string; init: Parameters<FetchFn>[1] }> } {
  const calls: Array<{ url: string; init: Parameters<FetchFn>[1] }> = [];
  let i = 0;
  const fn: FetchFn = async (url, init) => {
    calls.push({ url, init });
    const r = responses[i++];
    if (!r) throw new Error('fakeFetch: no scripted response left');
    return {
      status: r.status,
      json: async () => r.json,
      text: async () => r.text ?? '',
    };
  };
  return { fn, calls };
}

const HEARTBEAT: HeartbeatResponse = {
  agent: { id: 'a1', name: 'agent-1', status: 'online' },
  pollIntervalMs: 10_000,
  heartbeatIntervalMs: 30_000,
};

const JOB: ClaimedJob = {
  id: 'job-1',
  kind: 'backup',
  projectId: 'proj-1',
  leaseSeconds: 60,
  attempt: 1,
  maxAttempts: 3,
  plan: { paths: [], configs: [], databases: [] },
  retention: null,
  restore: null,
  repo: { url: 'sftp:backup@host:/repo', password: 'pw' },
  ssh: { privateKey: 'key', hostKeyLine: 'host ssh-ed25519 AAAA' },
};

describe('AgentApiClient', () => {
  it('heartbeat posts version/hostname and returns the parsed response', async () => {
    const { fn, calls } = fakeFetch([{ status: 200, json: HEARTBEAT }]);
    const client = new AgentApiClient({ baseUrl: 'https://dockstash.com', token: 'tok', fetchFn: fn });
    await expect(client.heartbeat({ version: '0.1.0', hostname: 'vps-1' })).resolves.toEqual(
      HEARTBEAT,
    );
    expect(calls[0]!.url).toBe('https://dockstash.com/api/agent/heartbeat');
    expect(calls[0]!.init.method).toBe('POST');
    expect(calls[0]!.init.headers.authorization).toBe('Bearer tok');
    expect(JSON.parse(calls[0]!.init.body ?? '{}')).toEqual({
      version: '0.1.0',
      hostname: 'vps-1',
    });
  });

  it('claimJob returns the claimed job on 200', async () => {
    const { fn } = fakeFetch([{ status: 200, json: { job: JOB } }]);
    const client = new AgentApiClient({ baseUrl: 'https://dockstash.com', token: 'tok', fetchFn: fn });
    await expect(client.claimJob()).resolves.toEqual(JOB);
  });

  it('claimJob returns null on 204 (empty queue)', async () => {
    const { fn } = fakeFetch([{ status: 204 }]);
    const client = new AgentApiClient({ baseUrl: 'https://dockstash.com', token: 'tok', fetchFn: fn });
    await expect(client.claimJob()).resolves.toBeNull();
  });

  it('postLogs posts the batched lines', async () => {
    const { fn, calls } = fakeFetch([{ status: 200, json: {} }]);
    const client = new AgentApiClient({ baseUrl: 'https://dockstash.com', token: 'tok', fetchFn: fn });
    await client.postLogs('job-1', ['line one', 'line two']);
    expect(calls[0]!.url).toBe('https://dockstash.com/api/agent/jobs/job-1/logs');
    expect(JSON.parse(calls[0]!.init.body ?? '{}')).toEqual({ lines: ['line one', 'line two'] });
  });

  it('postResult posts the job result', async () => {
    const { fn, calls } = fakeFetch([{ status: 200, json: {} }]);
    const client = new AgentApiClient({ baseUrl: 'https://dockstash.com', token: 'tok', fetchFn: fn });
    await client.postResult('job-1', { ok: true, stats: { snapshotCount: 2 } });
    expect(calls[0]!.url).toBe('https://dockstash.com/api/agent/jobs/job-1/result');
    expect(JSON.parse(calls[0]!.init.body ?? '{}')).toEqual({
      ok: true,
      stats: { snapshotCount: 2 },
    });
  });

  it('throws a truncated ApiError for >=400 responses', async () => {
    const longText = 'x'.repeat(500);
    const { fn } = fakeFetch([{ status: 401, text: longText }]);
    const client = new AgentApiClient({ baseUrl: 'https://dockstash.com', token: 'tok', fetchFn: fn });
    const err = await client.heartbeat({}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    expect((err as ApiError).name).toBe('ApiError');
    expect((err as ApiError).message).toContain('POST /heartbeat failed (401)');
    expect((err as ApiError).message.length).toBeLessThan(longText.length + 100);
  });

  it('falls back to the global fetch when no fetchFn is injected', () => {
    // Evaluated entirely at construction time (`opts.fetchFn ?? fetch`); no
    // network call is made in this test.
    expect(
      () => new AgentApiClient({ baseUrl: 'https://dockstash.com', token: 'tok' }),
    ).not.toThrow();
  });
});
