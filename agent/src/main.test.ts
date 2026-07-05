import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./executor.js', () => ({
  executeJob: vi.fn(async () => ({ ok: true })),
}));

import { AGENT_VERSION, productionExecute, runAgent } from './main.js';
import { executeJob } from './executor.js';
import { ProcessResticRunner } from './restic-runner.js';
import { HttpDockerClient } from './docker-client.js';
import { loadConfig } from './config.js';
import type { HealthStatus } from './health.js';
import type { PollerLogger } from './poller.js';
import type { ClaimedJob, JobResult } from './types.js';

const VALID_TOKEN = `dsa_${'a'.repeat(24)}.${'b'.repeat(48)}`;

function makeLogger(): PollerLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeFakeHealthServer(): { server: Server; closeSpy: ReturnType<typeof vi.fn> } {
  const closeSpy = vi.fn((cb?: (err?: Error) => void) => {
    cb?.();
  });
  const server = { close: closeSpy } as unknown as Server;
  return { server, closeSpy };
}

function testJob(overrides: Partial<ClaimedJob> = {}): ClaimedJob {
  return {
    id: 'job-1',
    kind: 'check',
    projectId: 'proj-1',
    leaseSeconds: 60,
    attempt: 1,
    maxAttempts: 3,
    plan: { paths: [], configs: [], databases: [] },
    retention: null,
    restore: null,
    repo: { url: 'sftp:backup@host:/repo', password: 'repo-pw' },
    ssh: { privateKey: 'PRIVATE', hostKeyLine: 'host ssh-ed25519 AAAA' },
    ...overrides,
  };
}

describe('runAgent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('boots the poller and health server from injected deps, claims+executes a job, and shuts down cleanly', async () => {
    const theJob = testJob({ id: 'job-live' });
    const fakeFetch = vi.fn(async (url: string) => {
      if (url.endsWith('/jobs/claim')) {
        return { status: 200, json: async () => ({ job: theJob }), text: async () => '' };
      }
      return {
        status: 200,
        json: async () => ({
          agent: { id: 'a1', name: 'agent-1', status: 'online' },
          pollIntervalMs: 10_000,
          heartbeatIntervalMs: 30_000,
        }),
        text: async () => '',
      };
    });
    vi.stubGlobal('fetch', fakeFetch);

    const log = makeLogger();
    const { server: fakeHealth, closeSpy } = makeFakeHealthServer();
    const startHealth = vi.fn((_port: number, statusFn: () => HealthStatus) => {
      // Exercise the status callback runAgent wires into the health server.
      expect(statusFn()).toEqual({ runningJobId: null, lastHeartbeatAt: null });
      return fakeHealth;
    });
    const execute = vi.fn(async (_job: ClaimedJob, pushLog: (line: string) => void) => {
      pushLog('doing the thing');
      return { ok: true } as JobResult;
    });

    const running = await runAgent({
      env: {
        DOCKSTASH_URL: 'https://agent-test.invalid',
        DOCKSTASH_AGENT_TOKEN: VALID_TOKEN,
      },
      logger: log,
      hostname: 'vps-test',
      execute,
      startHealth,
      collectDiscovery: async () => ({ folders: [], containers: [], dockerAvailable: false, roots: ['/var/www'], errors: [] }),
    });

    // Immediate heartbeat is fired synchronously by poller.start().
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(fakeFetch).toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://agent-test.invalid', healthPort: 9924 }),
      'dockstash-agent started',
    );
    expect(startHealth).toHaveBeenCalledWith(9924, expect.any(Function));
    expect(running.health).toBe(fakeHealth);

    // Drive one poll cycle directly (rather than waiting on the real
    // pollIntervalMs timer) to exercise the execute wrapper runAgent wires
    // into the Poller, end to end through the injected `execute` fn.
    await running.poller.pollOnce();
    expect(execute).toHaveBeenCalledWith(theJob, expect.any(Function), expect.any(Object));

    await running.shutdown();
    expect(log.info).toHaveBeenCalledWith({}, 'dockstash-agent draining');
    expect(closeSpy).toHaveBeenCalled();
  });

  it('defaults hostname via os.hostname() and logger via makeLogger() when omitted', async () => {
    const fakeFetch = vi.fn(async () => ({
      status: 204,
      json: async () => null,
      text: async () => '',
    }));
    vi.stubGlobal('fetch', fakeFetch);
    const { server: fakeHealth } = makeFakeHealthServer();
    const startHealth = vi.fn(() => fakeHealth);
    const execute = vi.fn(async () => ({ ok: true }) as JobResult);

    const running = await runAgent({
      env: {
        DOCKSTASH_URL: 'https://agent-test.invalid',
        DOCKSTASH_AGENT_TOKEN: VALID_TOKEN,
      },
      execute,
      startHealth,
      collectDiscovery: async () => ({ folders: [], containers: [], dockerAvailable: false, roots: ['/var/www'], errors: [] }),
    });

    expect(running.poller).toBeDefined();
    await running.shutdown();
  });

  it('falls back to process.env, the real startHealthServer, and productionExecute when nothing is injected', async () => {
    const realFetch = globalThis.fetch;
    const fakeFetch = vi.fn(async () => ({
      status: 204,
      json: async () => null,
      text: async () => '',
    }));
    vi.stubGlobal('fetch', fakeFetch);
    vi.stubEnv('DOCKSTASH_URL', 'https://agent-test.invalid');
    vi.stubEnv('DOCKSTASH_AGENT_TOKEN', VALID_TOKEN);
    vi.stubEnv('HEALTH_PORT', '47932'); // fixed unlikely-to-collide test-only port

    const log = makeLogger();
    const running = await runAgent({ logger: log });

    await new Promise<void>((resolve) => running.health.once('listening', resolve));
    const port = (running.health.address() as AddressInfo).port;
    const res = await realFetch(`http://127.0.0.1:${port}/healthz`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      lastHeartbeatAt: string | null;
      runningJobId: string | null;
    };
    // The immediate heartbeat fired by poller.start() already succeeded
    // against the stubbed fetch by the time this request lands.
    expect(body.ok).toBe(true);
    expect(body.runningJobId).toBeNull();
    expect(typeof body.lastHeartbeatAt === 'string' || body.lastHeartbeatAt === null).toBe(true);

    await running.shutdown();
  }, 10_000);
});

describe('productionExecute', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('constructs a fresh restic runner + docker client per job and delegates to executeJob', async () => {
    const config = loadConfig({
      DOCKSTASH_URL: 'https://agent-test.invalid',
      DOCKSTASH_AGENT_TOKEN: VALID_TOKEN,
      RESTIC_BINARY: 'restic',
      RESTIC_CACHE_DIR: '/tmp/restic-cache',
      DOCKER_HOST: 'tcp://docker-socket-proxy:2375',
    });
    const job = testJob();
    const pushLog = vi.fn();

    const result = await productionExecute(job, pushLog, config);

    expect(result).toEqual({ ok: true });
    expect(executeJob).toHaveBeenCalledTimes(1);
    const [calledJob, deps] = vi.mocked(executeJob).mock.calls[0]!;
    expect(calledJob).toBe(job);
    expect(deps.log).toBe(pushLog);
    expect(deps.restic).toBeInstanceOf(ProcessResticRunner);
    expect(deps.docker).toBeInstanceOf(HttpDockerClient);
  });
});

describe('AGENT_VERSION', () => {
  it('is a stable semantic version string', () => {
    expect(AGENT_VERSION).toBe('0.2.0');
  });
});
