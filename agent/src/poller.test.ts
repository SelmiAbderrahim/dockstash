import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LogBatcher, Poller, type PollerLogger } from './poller.js';
import type { AgentApiClient } from './api-client.js';
import type { AgentDiscoverySnapshot } from './discovery.js';
import type { ClaimedJob, JobResult } from './types.js';

function makeLogger(): PollerLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const SNAP: AgentDiscoverySnapshot = {
  folders: [{ name: 'app', path: '/var/www/app', hasCompose: true, composeFile: 'docker-compose.yml' }],
  containers: [],
  dockerAvailable: true,
};

function job(id = 'job-1'): ClaimedJob {
  return {
    id,
    kind: 'check',
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
}

describe('LogBatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not post until the max-lines threshold is reached', () => {
    const postLogs = vi.fn(async () => {});
    const batcher = new LogBatcher({ postLogs }, 'job-1', { maxLines: 5 });
    batcher.push('a');
    batcher.push('b');
    expect(postLogs).not.toHaveBeenCalled();
  });

  it('flushes automatically once maxLines lines accumulate', async () => {
    const postLogs = vi.fn(async () => {});
    const batcher = new LogBatcher({ postLogs }, 'job-1', { maxLines: 2 });
    batcher.push('a');
    batcher.push('b');
    await vi.advanceTimersByTimeAsync(0);
    expect(postLogs).toHaveBeenCalledTimes(1);
    expect(postLogs).toHaveBeenCalledWith('job-1', ['a', 'b']);
  });

  it('flushes on the timer interval', async () => {
    const postLogs = vi.fn(async () => {});
    const batcher = new LogBatcher({ postLogs }, 'job-1', { flushMs: 1000 });
    batcher.start();
    batcher.push('line');
    await vi.advanceTimersByTimeAsync(1000);
    expect(postLogs).toHaveBeenCalledWith('job-1', ['line']);
    await batcher.stop();
  });

  it('flush is a no-op when the buffer is empty', async () => {
    const postLogs = vi.fn(async () => {});
    const batcher = new LogBatcher({ postLogs }, 'job-1');
    await batcher.flush();
    expect(postLogs).not.toHaveBeenCalled();
  });

  it('swallows postLogs rejections', async () => {
    const postLogs = vi.fn(async () => {
      throw new Error('network down');
    });
    const batcher = new LogBatcher({ postLogs }, 'job-1');
    batcher.push('line');
    await expect(batcher.flush()).resolves.toBeUndefined();
  });

  it('stop clears the timer and flushes any remaining buffer', async () => {
    const postLogs = vi.fn(async () => {});
    const batcher = new LogBatcher({ postLogs }, 'job-1', { flushMs: 5000 });
    batcher.start();
    batcher.push('final line');
    await batcher.stop();
    expect(postLogs).toHaveBeenCalledWith('job-1', ['final line']);
    postLogs.mockClear();
    // Timer was cleared — advancing time must not trigger another flush.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(postLogs).not.toHaveBeenCalled();
  });
});

interface FakeApi {
  heartbeat: ReturnType<typeof vi.fn>;
  claimJob: ReturnType<typeof vi.fn>;
  postLogs: ReturnType<typeof vi.fn>;
  postResult: ReturnType<typeof vi.fn>;
}

function makeFakeApi(): FakeApi {
  return {
    heartbeat: vi.fn(async () => ({
      agent: { id: 'a1', name: 'agent', status: 'online' as const },
      pollIntervalMs: 10_000,
      heartbeatIntervalMs: 30_000,
    })),
    claimJob: vi.fn(async () => null),
    postLogs: vi.fn(async () => {}),
    postResult: vi.fn(async () => {}),
  };
}

function asApiClient(fake: FakeApi): AgentApiClient {
  return fake as unknown as AgentApiClient;
}

describe('Poller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function makePoller(
    fake: FakeApi,
    overrides: Partial<{
      execute(job: ClaimedJob, pushLog: (line: string) => void): Promise<JobResult>;
      pollIntervalMs: number;
      heartbeatIntervalMs: number;
    }> = {},
    log: PollerLogger = makeLogger(),
  ): { poller: Poller; log: PollerLogger } {
    const poller = new Poller({
      api: asApiClient(fake),
      log,
      version: '0.1.0',
      hostname: 'vps-1',
      pollIntervalMs: overrides.pollIntervalMs ?? 10_000,
      heartbeatIntervalMs: overrides.heartbeatIntervalMs ?? 30_000,
      execute: overrides.execute ?? (async () => ({ ok: true })),
      jitter: () => 0,
    });
    return { poller, log };
  }

  it('fires an immediate heartbeat on start and records lastHeartbeatAt', async () => {
    const fake = makeFakeApi();
    const { poller } = makePoller(fake);
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fake.heartbeat).toHaveBeenCalledTimes(1);
    expect(poller.status().lastHeartbeatAt).not.toBeNull();
    await poller.stop();
  });

  function makeDiscoveryPoller(
    fake: FakeApi,
    collect: () => Promise<AgentDiscoverySnapshot>,
    opts: { discoveryIntervalMs?: number; now?: () => number } = {},
    log: PollerLogger = makeLogger(),
  ): { poller: Poller; log: PollerLogger } {
    const poller = new Poller({
      api: asApiClient(fake),
      log,
      version: '0.1.0',
      hostname: 'vps-1',
      pollIntervalMs: 10_000,
      heartbeatIntervalMs: 30_000,
      execute: async () => ({ ok: true }),
      jitter: () => 0,
      collectDiscovery: collect,
      ...opts,
    });
    return { poller, log };
  }

  it('attaches a discovery snapshot to the heartbeat (default clock + interval)', async () => {
    const fake = makeFakeApi();
    const collect = vi.fn(async () => SNAP);
    const { poller } = makeDiscoveryPoller(fake, collect);
    await poller.heartbeatOnce();
    expect(collect).toHaveBeenCalledTimes(1);
    expect(fake.heartbeat).toHaveBeenCalledWith({
      version: '0.1.0',
      hostname: 'vps-1',
      discovery: SNAP,
    });
  });

  it('reuses the cached snapshot within the throttle window', async () => {
    const fake = makeFakeApi();
    const collect = vi.fn(async () => SNAP);
    const now = vi.fn(() => 1000);
    const { poller } = makeDiscoveryPoller(fake, collect, { discoveryIntervalMs: 5000, now });
    await poller.heartbeatOnce();
    await poller.heartbeatOnce();
    expect(collect).toHaveBeenCalledTimes(1);
  });

  it('recomputes the snapshot after the throttle window elapses', async () => {
    const fake = makeFakeApi();
    const collect = vi.fn(async () => SNAP);
    let t = 1000;
    const now = () => t;
    const { poller } = makeDiscoveryPoller(fake, collect, { discoveryIntervalMs: 5000, now });
    await poller.heartbeatOnce();
    t += 6000;
    await poller.heartbeatOnce();
    expect(collect).toHaveBeenCalledTimes(2);
  });

  it('omits discovery and warns when the collector throws', async () => {
    const fake = makeFakeApi();
    const collect = vi.fn(async () => {
      throw new Error('scan boom');
    });
    const { poller, log } = makeDiscoveryPoller(fake, collect, { now: () => 1 });
    await poller.heartbeatOnce();
    expect(log.warn).toHaveBeenCalledWith({ err: expect.any(Error) }, 'discovery collect failed');
    expect(fake.heartbeat).toHaveBeenCalledWith({ version: '0.1.0', hostname: 'vps-1' });
  });

  it('logs a warning when heartbeat fails, without crashing', async () => {
    const fake = makeFakeApi();
    fake.heartbeat.mockRejectedValueOnce(new Error('unreachable'));
    const { poller, log } = makePoller(fake);
    await poller.heartbeatOnce();
    expect(log.warn).toHaveBeenCalledWith({ err: expect.any(Error) }, 'heartbeat failed');
    expect(poller.status().lastHeartbeatAt).toBeNull();
  });

  it('pollOnce does nothing when the queue is empty', async () => {
    const fake = makeFakeApi();
    const execute = vi.fn(async () => ({ ok: true }) as JobResult);
    const { poller } = makePoller(fake, { execute });
    await poller.pollOnce();
    expect(execute).not.toHaveBeenCalled();
    expect(poller.status().runningJobId).toBeNull();
  });

  it('logs a warning when claiming a job fails', async () => {
    const fake = makeFakeApi();
    fake.claimJob.mockRejectedValueOnce(new Error('401'));
    const { poller, log } = makePoller(fake);
    await poller.pollOnce();
    expect(log.warn).toHaveBeenCalledWith({ err: expect.any(Error) }, 'job claim failed');
  });

  it('claims and executes a job, wiring pushLog through to postLogs and the result through to postResult', async () => {
    const fake = makeFakeApi();
    const theJob = job('job-42');
    fake.claimJob.mockResolvedValueOnce(theJob);
    // `execute` closes over `poller` before it exists; `poller` is assigned
    // exactly once, right after construction, before `execute` can ever be
    // invoked.
    // eslint-disable-next-line prefer-const
    let poller!: Poller;
    let sawRunningId: string | null = null;
    const execute = vi.fn(async (_j: ClaimedJob, pushLog: (line: string) => void) => {
      // The job id is assigned synchronously before `execute` is invoked.
      sawRunningId = poller.status().runningJobId;
      pushLog('working...');
      return { ok: true, stats: { snapshotCount: 1 } } satisfies JobResult;
    });
    const built = makePoller(fake, { execute });
    poller = built.poller;
    const log = built.log;

    const pending = poller.pollOnce();
    await pending;

    expect(sawRunningId).toBe('job-42');
    expect(execute).toHaveBeenCalledWith(theJob, expect.any(Function));
    expect(fake.postResult).toHaveBeenCalledWith('job-42', { ok: true, stats: { snapshotCount: 1 } });
    expect(fake.postLogs).toHaveBeenCalledWith('job-42', ['working...']);
    expect(log.info).toHaveBeenCalledWith({ jobId: 'job-42', ok: true }, 'job finished');
    expect(poller.status().runningJobId).toBeNull();
  });

  it('skips polling while a job is already running', async () => {
    const fake = makeFakeApi();
    const theJob = job('job-running');
    fake.claimJob.mockResolvedValueOnce(theJob);
    let resolveExecute: (() => void) | null = null;
    const execute = vi.fn(
      () =>
        new Promise<JobResult>((resolve) => {
          resolveExecute = () => resolve({ ok: true });
        }),
    );
    const { poller } = makePoller(fake, { execute });

    const firstPoll = poller.pollOnce();
    await vi.advanceTimersByTimeAsync(0);
    expect(poller.status().runningJobId).toBe('job-running');

    await poller.pollOnce(); // should return immediately, no second claim
    expect(fake.claimJob).toHaveBeenCalledTimes(1);

    resolveExecute?.();
    await firstPoll;
  });

  it('logs an error (and clears runningJobId) when postResult rejects', async () => {
    const fake = makeFakeApi();
    const theJob = job('job-err');
    fake.claimJob.mockResolvedValueOnce(theJob);
    fake.postResult.mockRejectedValueOnce(new Error('server 500'));
    const { poller, log } = makePoller(fake, { execute: async () => ({ ok: true }) });
    await poller.pollOnce();
    expect(log.error).toHaveBeenCalledWith(
      { err: expect.any(Error), jobId: 'job-err' },
      'job result post failed',
    );
    expect(poller.status().runningJobId).toBeNull();
  });

  it('start() twice is a no-op the second time', async () => {
    const fake = makeFakeApi();
    const { poller } = makePoller(fake);
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fake.heartbeat).toHaveBeenCalledTimes(1);
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fake.heartbeat).toHaveBeenCalledTimes(1);
    await poller.stop();
  });

  it('stop() clears timers and drains an in-flight job before resolving', async () => {
    const fake = makeFakeApi();
    const theJob = job('job-drain');
    fake.claimJob.mockResolvedValueOnce(theJob);
    let resolveExecute: (() => void) | null = null;
    const execute = vi.fn(
      () =>
        new Promise<JobResult>((resolve) => {
          resolveExecute = () => resolve({ ok: true });
        }),
    );
    const { poller } = makePoller(fake, { execute });

    const pending = poller.pollOnce();
    await vi.advanceTimersByTimeAsync(0);
    expect(poller.status().runningJobId).toBe('job-drain');

    const stopping = poller.stop(10);
    let stopped = false;
    void stopping.then(() => {
      stopped = true;
    });

    await vi.advanceTimersByTimeAsync(50);
    expect(stopped).toBe(false); // still draining — job hasn't finished yet

    resolveExecute?.();
    await pending;
    await vi.advanceTimersByTimeAsync(50);
    await stopping;
    expect(stopped).toBe(true);
  });

  it('clamps jittered intervals to a 250ms floor', async () => {
    const fake = makeFakeApi();
    const poller = new Poller({
      api: asApiClient(fake),
      log: makeLogger(),
      version: '0.1.0',
      hostname: 'vps-1',
      pollIntervalMs: 10_000,
      heartbeatIntervalMs: 1000,
      execute: async () => ({ ok: true }),
      jitter: () => -1, // 1000 * (1 + -1) = 0, clamped up to 250
    });
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fake.heartbeat).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(250);
    expect(fake.heartbeat).toHaveBeenCalledTimes(2);
    await poller.stop();
  });
});
