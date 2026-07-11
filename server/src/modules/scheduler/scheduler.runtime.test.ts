import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import jwt from 'jsonwebtoken';
import type { Server as IoServer } from 'socket.io';
import { env } from '../../config/env.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { User } from '../users/index.js';
import { createProject } from '../backups/backups.service.js';
import type { Job, JobData, ResticRunnerExt } from './scheduler.boundaries.js';

// --- node-cron mock: capture the wrapped callbacks so we can fire them ----
const cronState = vi.hoisted(() => ({
  callbacks: [] as Array<() => unknown>,
  stops: [] as Array<() => void>,
}));

vi.mock('node-cron', () => {
  const schedule = (_expr: string, cb: () => unknown): { stop: () => void } => {
    cronState.callbacks.push(cb);
    const stop = vi.fn();
    cronState.stops.push(stop);
    return { stop };
  };
  const validate = (): boolean => true;
  return { default: { schedule, validate }, schedule, validate };
});

// --- bullmq mock: fake Queue/Worker, capturing instances -----------------
const bullState = vi.hoisted(() => ({
  workers: [] as Array<{ name: string; processor: (j: unknown) => Promise<void>; close: () => Promise<void> }>,
  queues: [] as Array<{ name: string; close: () => Promise<void> }>,
  rejectClose: false,
  addIdNull: false,
  addCounter: 0,
}));

vi.mock('bullmq', () => {
  class Queue {
    name: string;
    constructor(name: string) {
      this.name = name;
      bullState.queues.push(this);
    }
    async add(_name: string, data: JobData): Promise<{ id: string | undefined; data: JobData; attemptsMade: number }> {
      bullState.addCounter += 1;
      return {
        id: bullState.addIdNull ? undefined : `bq-${bullState.addCounter}`,
        data,
        attemptsMade: 0,
      };
    }
    async close(): Promise<void> {
      if (bullState.rejectClose) throw new Error('queue close failed');
    }
  }
  class Worker {
    name: string;
    processor: (j: unknown) => Promise<void>;
    constructor(name: string, processor: (j: unknown) => Promise<void>) {
      this.name = name;
      this.processor = processor;
      bullState.workers.push(this);
    }
    async close(): Promise<void> {
      if (bullState.rejectClose) throw new Error('worker close failed');
    }
  }
  return { Queue, Worker };
});

// --- alerting mock: control the heartbeat sweep outcome per firing --------
vi.mock('../alerting/index.js', () => ({
  runHeartbeatSweep: vi.fn(async () => undefined),
  sendFailureAlert: vi.fn(async () => undefined),
}));

// --- agents mock: control the fleet maintenance sweep outcome per firing --
vi.mock('../agents/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../agents/index.js')>();
  return {
    ...actual,
    expireStaleAgentJobs: vi.fn(async () => undefined),
    sweepOfflineAgents: vi.fn(async () => undefined),
  };
});

const { BullmqQueueBackend } = await import('./scheduler.queue.bullmq.js');
const { NodeCronScheduler } = await import('./scheduler.cron.node.js');
const { startScheduler } = await import('./scheduler.runtime.js');
const alerting = await import('../alerting/index.js');
const agents = await import('../agents/index.js');

function makeRestic(): ResticRunnerExt {
  return {
    async init() {},
    async backup() {},
    async snapshots() {
      return [];
    },
    async check() {},
    async restore() {},
    async snapshotsDetailed() {
      return [];
    },
    async dump(): Promise<never> {
      throw new Error('dump not stubbed');
    },
    async unlock() {},
    async forget() {},
  };
}

interface AuthSocket extends EventEmitter {
  handshake: { auth: { token?: string }; headers: Record<string, string> };
  data: { userId?: string };
  join(room: string): Promise<void>;
}

function makeFakeIo(): {
  io: IoServer;
  simulateJoin(token: string, jobId: string): Promise<unknown>;
} {
  let mw: ((sock: unknown, next: (err?: Error) => void) => void) | undefined;
  let connHandler: ((sock: unknown) => void) | undefined;
  const nsp = {
    use(fn: (sock: unknown, next: (err?: Error) => void) => void) {
      mw = fn;
    },
    on(event: string, handler: (sock: unknown) => void) {
      if (event === 'connection') connHandler = handler;
    },
    to() {
      return { emit() {} };
    },
  };
  return {
    io: { of: () => nsp } as unknown as IoServer,
    async simulateJoin(token: string, jobId: string): Promise<unknown> {
      const sock = new EventEmitter() as AuthSocket;
      sock.handshake = { auth: { token }, headers: {} };
      sock.data = {};
      sock.join = async () => {};
      await new Promise<void>((resolve, reject) => {
        mw?.(sock, (err) => (err ? reject(err) : resolve()));
      });
      connHandler?.(sock);
      return new Promise((resolve) => {
        sock.emit('join', { jobId }, (r: unknown) => resolve(r));
      });
    },
  };
}

async function seedUserProject(): Promise<{ userId: string; projectId: string }> {
  const u = await User.create({
    email: `u-${Date.now()}-${Math.random()}@t.com`,
    password: 'irrelevant',
    profile: { firstName: 'S', lastName: 'U' },
    emailVerified: true,
  });
  const userId = u._id.toString();
  const p = await createProject(userId, {
    name: 'p',
    path: '/var/www/p',
    repoPassword: 'password1',
  });
  return { userId, projectId: p._id.toString() };
}

describe('scheduler.runtime: startScheduler', () => {
  beforeAll(() => startMemoryMongo());
  afterAll(() => stopMemoryMongo());
  beforeEach(async () => {
    await clearCollections();
    cronState.callbacks.length = 0;
    cronState.stops.length = 0;
  });

  it('boots (memory), processes a job, serves the log namespace, fires heartbeat', async () => {
    const original = env.REDIS_URL;
    (env as { REDIS_URL?: string }).REDIS_URL = undefined;
    const { userId, projectId } = await seedUserProject();
    const fake = makeFakeIo();
    const runtime = await startScheduler({
      io: fake.io,
      resticRunnerFor: () => makeRestic(),
      useBullmq: false,
    });
    expect(runtime.queue).toBeDefined();
    expect(runtime.cron).toBeDefined();
    // Periodic reconcile is registered so post-boot schedule mutations arm
    // without an api restart (thakaat incident regression).
    expect(runtime.cron.list()).toContain('__reconcile__');

    // Drive a job through the runtime's queue processor (covers the
    // setProcessor callback: owner index, resticRunnerFor, processJob).
    await runtime.queue.add({ projectId, owner: userId, kind: 'check' });
    await runtime.queue.waitIdle();

    // A join over the log namespace exercises the runtime's ownership.ownerOf:
    // unknown id → in-memory index miss + agent-job miss → rejected...
    const token = jwt.sign({ id: userId }, env.JWT_SECRET);
    const ack = await fake.simulateJoin(token, 'job-x');
    expect(ack).toMatchObject({ ok: false });
    // ...and the local job processed above ('1') → index hit → accepted.
    const okAck = await fake.simulateJoin(token, '1');
    expect(okAck).toMatchObject({ ok: true });

    // Heartbeat + fleet-maintenance crons were registered (no enabled
    // schedules). Fire them once for the success path (sweeps resolve)...
    for (const cb of cronState.callbacks) await cb();
    expect(agents.expireStaleAgentJobs).toHaveBeenCalled();
    expect(agents.sweepOfflineAgents).toHaveBeenCalled();
    // ...and once for the failure path (both sweeps throw → catch branches).
    (alerting.runHeartbeatSweep as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('heartbeat boom'),
    );
    (agents.expireStaleAgentJobs as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('lease sweep boom'),
    );
    for (const cb of cronState.callbacks) await cb();
    await runtime.shutdown();
    (env as { REDIS_URL?: string }).REDIS_URL = original;
  });

  it('logs the bullmq backend + configured redis branch and uses dispatchDepsFor', async () => {
    const original = env.REDIS_URL;
    (env as { REDIS_URL?: string }).REDIS_URL = 'redis://localhost:6379';
    const { userId, projectId } = await seedUserProject();
    const fake = makeFakeIo();
    const runtime = await startScheduler({
      io: fake.io,
      resticRunnerFor: () => makeRestic(),
      dispatchDepsFor: () => ({}),
      useBullmq: true,
    });
    // Process a job so the `dispatchDepsFor?.() ?? {}` present-branch runs.
    await runtime.queue.add({ projectId, owner: userId, kind: 'check' });
    await runtime.queue.waitIdle();
    await runtime.shutdown();
    (env as { REDIS_URL?: string }).REDIS_URL = original;
  });
});

describe('scheduler.cron.node: scheduled-callback error handling', () => {
  beforeEach(() => {
    cronState.callbacks.length = 0;
  });

  it('logs and swallows an error thrown by the scheduled run', async () => {
    const cron = new NodeCronScheduler();
    cron.register('boom', '* * * * *', async () => {
      throw new Error('run failed');
    });
    // Fire the captured wrapper callback → exercises the try/catch + logger.
    for (const cb of cronState.callbacks) await cb();
    expect(cron.list()).toEqual(['boom']);
  });
});

describe('scheduler.queue.bullmq: BullmqQueueBackend', () => {
  beforeEach(() => {
    bullState.workers.length = 0;
    bullState.queues.length = 0;
    bullState.rejectClose = false;
    bullState.addIdNull = false;
    bullState.addCounter = 0;
  });

  it('lazily creates one queue+worker pair per project and reuses them', async () => {
    const backend = new BullmqQueueBackend({}, 'scheduler-repo');
    backend.setProcessor(async () => {});
    await backend.add({ projectId: 'A', owner: 'u', kind: 'check' });
    await backend.add({ projectId: 'A', owner: 'u', kind: 'backup' });
    await backend.add({ projectId: 'B', owner: 'u', kind: 'check' });
    expect(bullState.queues).toHaveLength(2);
    expect(bullState.workers).toHaveLength(2);
    await backend.close();
  });

  it('add returns a synthetic id when bull provides none', async () => {
    bullState.addIdNull = true;
    const backend = new BullmqQueueBackend({});
    backend.setProcessor(async () => {});
    const job = await backend.add({ projectId: 'A', owner: 'u', kind: 'check' });
    expect(job.id).toBeTruthy();
    expect(job.attempts).toBe(0);
    await backend.close();
  });

  it('worker invokes the processor and tracks active count', async () => {
    const backend = new BullmqQueueBackend({});
    const seen: Job[] = [];
    backend.setProcessor(async (job) => {
      seen.push(job);
      expect(await backend.activeCountForProject('A')).toBe(1);
    });
    await backend.add({ projectId: 'A', owner: 'u', kind: 'check' });
    const worker = bullState.workers[0];
    if (!worker) throw new Error("worker not created");
    await worker.processor({
      id: 'j1',
      data: { projectId: 'A', owner: 'u', kind: 'check' } satisfies JobData,
      attemptsMade: 0,
    });
    expect(seen[0]?.id).toBe('j1');
    expect(seen[0]?.attempts).toBe(1);
    expect(await backend.activeCountForProject('A')).toBe(0);
    await backend.close();
  });

  it('worker synthesises an id when the bull job has none', async () => {
    const backend = new BullmqQueueBackend({});
    const seen: Job[] = [];
    backend.setProcessor(async (job) => {
      seen.push(job);
    });
    await backend.add({ projectId: 'A', owner: 'u', kind: 'check' });
    const worker = bullState.workers[0];
    if (!worker) throw new Error("worker not created");
    await worker.processor({
      id: undefined,
      data: { projectId: 'A', owner: 'u', kind: 'check' } satisfies JobData,
      attemptsMade: 2,
    });
    expect(seen[0]?.id).toBeTruthy();
    expect(seen[0]?.attempts).toBe(3);
    await backend.close();
  });

  it('worker throws when no processor is set', async () => {
    const backend = new BullmqQueueBackend({});
    await backend.add({ projectId: 'A', owner: 'u', kind: 'check' });
    const worker = bullState.workers[0];
    if (!worker) throw new Error("worker not created");
    await expect(
      worker.processor({
        id: 'x',
        data: { projectId: 'A', owner: 'u', kind: 'check' } satisfies JobData,
        attemptsMade: 0,
      }),
    ).rejects.toThrow(/processor not set/);
  });

  it('activeCountForProject defaults to 0 for an unknown project', async () => {
    const backend = new BullmqQueueBackend({});
    expect(await backend.activeCountForProject('nope')).toBe(0);
    await backend.waitIdle();
  });

  it('close swallows queue/worker close rejections and clears maps', async () => {
    const backend = new BullmqQueueBackend({});
    backend.setProcessor(async () => {});
    await backend.add({ projectId: 'A', owner: 'u', kind: 'check' });
    bullState.rejectClose = true;
    await backend.close();
    // After close, adding again re-creates a fresh pair.
    bullState.rejectClose = false;
    await backend.add({ projectId: 'A', owner: 'u', kind: 'check' });
    expect(bullState.queues.length).toBeGreaterThanOrEqual(2);
    await backend.close();
  });
});
