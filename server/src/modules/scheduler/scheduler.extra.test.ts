import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

// Feature suite runs in OSS self-host mode (PAYMENT_PROVIDER=none) so paid-tier
// entitlements (schedules) are unrestricted here — billing tiering itself is
// covered by the billing suites.
const __prevPaymentProvider = env.PAYMENT_PROVIDER;
beforeAll(() => {
  (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'none';
});
afterAll(() => {
  (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = __prevPaymentProvider;
});
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { User } from '../users/index.js';
import { SCHEDULER_BOUNDARY_VERSION } from './scheduler.boundaries.js';
import { attachLogStream } from './scheduler.logstream.js';
import { createProject } from '../backups/backups.service.js';
import type {
  DbDiffer,
  DockerClient,
  FileDiffer,
  ScratchWorkspace,
} from '../backups/backups.boundaries.js';
import { Readable } from 'node:stream';
import { Schedule } from './scheduler.model.js';
import { MemoryQueue } from './scheduler.queue.memory.js';
import { dispatchJob, processJob } from './scheduler.dispatcher.js';
import { enqueueFromSchedule, reconcileCron } from './scheduler.cron.js';
import { allowAllEntitlements } from './scheduler.entitlements.js';
import { createSchedule, updateSchedule, enqueueNow } from './scheduler.service.js';
import { serializeSchedule } from './scheduler.serialize.js';
import { runPrune } from './scheduler.prune.service.js';
import type {
  ResticRunnerExt,
  SchedulerCron,
  SchedulerQueue,
} from './scheduler.boundaries.js';

beforeAll(() => startMemoryMongo());
afterAll(() => stopMemoryMongo());
beforeEach(() => clearCollections());

function makeRestic(overrides: Partial<ResticRunnerExt> = {}): ResticRunnerExt {
  const base: ResticRunnerExt = {
    async init() {},
    async backup(_args, opts) {
      if (opts?.stdin) opts.stdin.resume();
    },
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
  return Object.assign(base, overrides);
}

function makeDocker(): DockerClient {
  return {
    async exec() {
      return Readable.from(['dump-bytes']);
    },
    async execStream() {
      return {
        stream: Readable.from(['dump-bytes']),
        exit: async () => ({ exitCode: 0, stderrTail: '' }),
      };
    },
    async execCollect() {
      return { exitCode: 0, stdout: 'OK', stderr: '' };
    },
    async execWithStdin() {
      throw new Error('execWithStdin not stubbed');
    },
    async restart() {
      throw new Error('restart not stubbed');
    },
    async inspect(container) {
      return { id: container, running: true, env: [], cmd: [], image: '' };
    },
    async listContainers() {
      return [];
    },
  };
}

async function seedUser(email: string): Promise<string> {
  const u = await User.create({
    email,
    password: 'irrelevant',
    profile: { firstName: 'S', lastName: 'U' },
    emailVerified: true,
  });
  return u._id.toString();
}

async function seedProject(userId: string): Promise<string> {
  const p = await createProject(userId, {
    name: 'p',
    path: '/var/www/p',
    repoPassword: 'password1',
  });
  return p._id.toString();
}

describe('scheduler.extra: boundaries module loads', () => {
  it('exposes a runtime marker for coverage accounting', () => {
    expect(SCHEDULER_BOUNDARY_VERSION).toBe(1);
  });
});

describe('scheduler.extra: model retention default', () => {
  it('applies the retention default when the field is omitted', async () => {
    const userId = await seedUser('a@t.com');
    const projectId = await seedProject(userId);
    // Omitting `retention` entirely forces mongoose to invoke the schema
    // default factory `() => ({})`.
    const doc = await Schedule.create({
      project: projectId,
      owner: userId,
      kind: 'backup',
      cron: '0 3 * * *',
    });
    expect(doc.retention.keepDaily).toBe(7);
    expect(doc.retention.keepWeekly).toBe(4);
    expect(doc.retention.keepMonthly).toBe(6);
  });
});

describe('scheduler.extra: dispatcher remaining branches', () => {
  it('drill runs when scratch/fileDiff/dbDiff are all present', async () => {
    const userId = await seedUser('a@t.com');
    const projectId = await seedProject(userId);
    const scratch: ScratchWorkspace = {
      async create() {
        return '/tmp/scratch';
      },
      async remove() {},
    };
    const fileDiff: FileDiffer = {
      async diff() {
        return { mismatches: 0, details: [] };
      },
    };
    const dbDiff: DbDiffer = {
      async diff() {
        return { mismatches: 0, details: [] };
      },
    };
    // no `t` → exercises the dispatcher identity translator fallback
    await dispatchJob(
      { id: '1', attempts: 1, data: { projectId, owner: userId, kind: 'drill' } },
      { resticRunner: makeRestic(), scratch, fileDiff, dbDiff },
    );
  });

  it('drill missing fileDiff (scratch present) still throws', async () => {
    const userId = await seedUser('a@t.com');
    const projectId = await seedProject(userId);
    const scratch: ScratchWorkspace = {
      async create() {
        return '/tmp/scratch';
      },
      async remove() {},
    };
    await expect(
      dispatchJob(
        { id: '1', attempts: 1, data: { projectId, owner: userId, kind: 'drill' } },
        { resticRunner: makeRestic(), scratch },
      ),
    ).rejects.toThrow(/requires/);
  });

  it('drill missing dbDiff (scratch + fileDiff present) still throws', async () => {
    const userId = await seedUser('a@t.com');
    const projectId = await seedProject(userId);
    const scratch: ScratchWorkspace = {
      async create() {
        return '/tmp/scratch';
      },
      async remove() {},
    };
    const fileDiff: FileDiffer = {
      async diff() {
        return { mismatches: 0, details: [] };
      },
    };
    await expect(
      dispatchJob(
        { id: '1', attempts: 1, data: { projectId, owner: userId, kind: 'drill' } },
        { resticRunner: makeRestic(), scratch, fileDiff },
      ),
    ).rejects.toThrow(/requires/);
  });

  it('backup dispatch succeeds with dockerClient (identity translator path)', async () => {
    const userId = await seedUser('a@t.com');
    const projectId = await seedProject(userId);
    await dispatchJob(
      { id: '1', attempts: 1, data: { projectId, owner: userId, kind: 'backup' } },
      { resticRunner: makeRestic(), dockerClient: makeDocker() },
    );
  });

  it('processJob uses default maxAttempts/sleep and retries via defaultSleep', async () => {
    const userId = await seedUser('a@t.com');
    const projectId = await seedProject(userId);
    let calls = 0;
    const restic = makeRestic({
      async forget() {
        calls += 1;
        if (calls < 2) throw new Error('transient');
      },
    });
    const queue = new MemoryQueue();
    queue.setProcessor(async () => {});
    // No maxAttempts, no baseBackoffMs, no sleep → default cap (3), default
    // backoff, and the real `defaultSleep` (setTimeout) is exercised on retry.
    await processJob(
      {
        id: '1',
        attempts: 0,
        data: {
          projectId,
          owner: userId,
          kind: 'prune',
          retention: { keepDaily: 1, keepWeekly: 1, keepMonthly: 1 },
        },
      },
      { resticRunner: restic, queue },
    );
    expect(calls).toBe(2);
  });

  it('wraps a non-Error thrown by the job into an Error on final failure', async () => {
    const userId = await seedUser('a@t.com');
    const projectId = await seedProject(userId);
    const restic = makeRestic({
      async forget() {
        throw 'string failure';
      },
    });
    const queue = new MemoryQueue();
    queue.setProcessor(async () => {});
    await expect(
      processJob(
        {
          id: '1',
          attempts: 0,
          data: {
            projectId,
            owner: userId,
            kind: 'prune',
            retention: { keepDaily: 1, keepWeekly: 1, keepMonthly: 1 },
          },
        },
        { resticRunner: restic, queue, maxAttempts: 1, sleep: async () => undefined },
      ),
    ).rejects.toThrow(/string failure/);
  });

  it('coerces a non-Error thrown from lock recovery into an Error', async () => {
    const userId = await seedUser('a@t.com');
    const projectId = await seedProject(userId);
    let firstAttempt = true;
    // Dispatch fails on attempt 1 (Error path); on attempt 2 the queue's
    // activeCountForProject throws a raw string, which reaches processJob's
    // catch as a non-Error → exercises the `new Error(String(err))` branch.
    const queue: SchedulerQueue = {
      async add(data) {
        return { id: '1', data, attempts: 0 };
      },
      async activeCountForProject() {
        throw 'orphan-check-exploded';
      },
      async waitIdle() {},
      async close() {},
    };
    const restic = makeRestic({
      async forget() {
        if (firstAttempt) {
          firstAttempt = false;
          throw new Error('first failure');
        }
      },
    });
    await expect(
      processJob(
        {
          id: '1',
          attempts: 0,
          data: {
            projectId,
            owner: userId,
            kind: 'prune',
            retention: { keepDaily: 1, keepWeekly: 1, keepMonthly: 1 },
          },
        },
        { resticRunner: restic, queue, maxAttempts: 2, baseBackoffMs: 1, sleep: async () => {} },
      ),
    ).rejects.toThrow(/orphan-check-exploded/);
  });

  it('throws the exhausted-with-no-error guard when maxAttempts is 0', async () => {
    const queue = new MemoryQueue();
    queue.setProcessor(async () => {});
    // maxAttempts=0 → the retry loop never enters → falls through to the
    // "exhausted" guard (exercises the loop-exit branch).
    await expect(
      processJob(
        { id: '1', attempts: 0, data: { projectId: 'A', owner: 'u', kind: 'check' } },
        { resticRunner: makeRestic(), queue, maxAttempts: 0 },
      ),
    ).rejects.toThrow(/exhausted/);
  });

  it('persistStatus swallows model errors for an invalid scheduleId', async () => {
    const userId = await seedUser('a@t.com');
    const projectId = await seedProject(userId);
    const queue = new MemoryQueue();
    queue.setProcessor(async () => {});
    // A non-ObjectId scheduleId makes findByIdAndUpdate throw a CastError,
    // which persistStatus must swallow (best-effort).
    await processJob(
      {
        id: '1',
        attempts: 0,
        data: {
          projectId,
          owner: userId,
          kind: 'check',
          scheduleId: 'not-a-valid-object-id',
        },
      },
      { resticRunner: makeRestic(), queue, maxAttempts: 1 },
    );
  });
});

describe('scheduler.extra: prune non-Error rejection', () => {
  it('wraps a non-Error thrown by forget', async () => {
    const userId = await seedUser('a@t.com');
    const projectId = await seedProject(userId);
    const restic = makeRestic({
      async forget() {
        throw 'string failure';
      },
    });
    await expect(
      runPrune(projectId, userId, { keepDaily: 1, keepWeekly: 1, keepMonthly: 1 }, {
        resticRunner: restic,
      }),
    ).rejects.toMatchObject({ status: 500 });
  });
});

describe('scheduler.extra: serialize with lastEnqueuedAt set', () => {
  it('emits an ISO string when lastEnqueuedAt is present', async () => {
    const userId = await seedUser('a@t.com');
    const projectId = await seedProject(userId);
    const s = await createSchedule(userId, {
      projectId,
      kind: 'backup',
      cron: '0 3 * * *',
    });
    s.lastEnqueuedAt = new Date('2024-01-01T00:00:00.000Z');
    await s.save();
    const pub = serializeSchedule(s);
    expect(pub.lastEnqueuedAt).toBe('2024-01-01T00:00:00.000Z');
  });
});

describe('scheduler.extra: service branch coverage', () => {
  it('updateSchedule keeps existing values for omitted retention fields', async () => {
    const userId = await seedUser('a@t.com');
    const projectId = await seedProject(userId);
    const s = await createSchedule(userId, {
      projectId,
      kind: 'backup',
      cron: '0 3 * * *',
    });
    // keepDaily omitted (falls back to existing), keepWeekly + keepMonthly set.
    // Values stay within the (business-tier, PAYMENT_PROVIDER=none) retention
    // ceiling of 90 days so clampRetentionPolicy is a no-op here — this test
    // is about the omitted-field merge, not the clamp (covered separately).
    const updated = await updateSchedule(s._id.toString(), userId, {
      retention: { keepWeekly: 9, keepMonthly: 3 },
    });
    expect(updated.retention.keepDaily).toBe(7);
    expect(updated.retention.keepWeekly).toBe(9);
    expect(updated.retention.keepMonthly).toBe(3);
  });

  it('enqueueNow uses the identity translator when none is provided (deny path)', async () => {
    const userId = await seedUser('a@t.com');
    const projectId = await seedProject(userId);
    const queue: SchedulerQueue = {
      async add(data) {
        return { id: '1', data, attempts: 0 };
      },
      async activeCountForProject() {
        return 0;
      },
      async waitIdle() {},
      async close() {},
    };
    await expect(
      enqueueNow(
        userId,
        { projectId, kind: 'backup' },
        {
          queue,
          entitlements: {
            async canEnqueue() {
              return false;
            },
          },
        },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('enqueueNow via scheduleId tolerates a schedule with no retention', async () => {
    const userId = await seedUser('a@t.com');
    const projectId = await seedProject(userId);
    const added: unknown[] = [];
    const queue: SchedulerQueue = {
      async add(data) {
        added.push(data);
        return { id: 'job-1', data, attempts: 0 };
      },
      async activeCountForProject() {
        return 0;
      },
      async waitIdle() {},
      async close() {},
    };
    // Fake schedule with retention undefined → exercises the `: undefined`
    // branch of the retention ternary in enqueueNow.
    const fakeSchedule = {
      _id: { toString: () => '507f1f77bcf86cd799439099' },
      owner: { toString: () => userId },
      project: { toString: () => projectId },
      kind: 'check' as const,
      retention: undefined,
    };
    const spy = vi
      .spyOn(Schedule, 'findOne')
      .mockResolvedValue(fakeSchedule as never);
    try {
      const job = await enqueueNow(
        userId,
        { scheduleId: '507f1f77bcf86cd799439099' },
        { queue, entitlements: allowAllEntitlements },
      );
      expect(job.data.retention).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('scheduler.extra: logstream token payload shapes', () => {
  function makeAuthRunner(): (sock: EventEmitter & {
    handshake: { auth: { token?: string }; headers: Record<string, string> };
    data: { userId?: string };
  }) => Promise<Error | undefined> {
    let mw:
      | ((sock: unknown, next: (err?: Error) => void) => void)
      | undefined;
    const nsp = {
      use(fn: (sock: unknown, next: (err?: Error) => void) => void) {
        mw = fn;
      },
      on() {},
      to() {
        return { emit() {} };
      },
    };
    attachLogStream({
      io: { of: () => nsp } as never,
      ownership: {
        async ownerOf() {
          return null;
        },
      },
    });
    return (sock) =>
      new Promise((resolve) => {
        mw?.(sock, (err) => resolve(err));
      });
  }

  function socketWith(token: string): EventEmitter & {
    handshake: { auth: { token?: string }; headers: Record<string, string> };
    data: { userId?: string };
  } {
    const sock = new EventEmitter() as EventEmitter & {
      handshake: { auth: { token?: string }; headers: Record<string, string> };
      data: { userId?: string };
    };
    sock.handshake = { auth: { token }, headers: {} };
    sock.data = {};
    return sock;
  }

  it('accepts a token carrying only `_id`', async () => {
    const run = makeAuthRunner();
    const sock = socketWith(jwt.sign({ _id: 'user-9' }, env.JWT_SECRET));
    const err = await run(sock);
    expect(err).toBeUndefined();
    expect(sock.data.userId).toBe('user-9');
  });

  it('rejects a valid token with neither `id` nor `_id`', async () => {
    const run = makeAuthRunner();
    const sock = socketWith(jwt.sign({}, env.JWT_SECRET));
    const err = await run(sock);
    expect(err).toBeInstanceOf(Error);
    expect(sock.data.userId).toBeUndefined();
  });

  it('rejects a token signed with a non-HS256 algorithm (algorithms pin)', async () => {
    // The verify path pins algorithms: ['HS256']. A token minted with the same
    // secret but a different HMAC alg must NOT authenticate — this is the guard
    // against alg-confusion / an expanded acceptance list.
    const run = makeAuthRunner();
    const sock = socketWith(jwt.sign({ _id: 'user-9' }, env.JWT_SECRET, { algorithm: 'HS512' }));
    const err = await run(sock);
    expect(err).toBeInstanceOf(Error);
    expect(sock.data.userId).toBeUndefined();
  });

  it('rejects an unsigned (alg:none) token', async () => {
    const run = makeAuthRunner();
    const noneToken = jwt.sign({ _id: 'user-9' }, '', { algorithm: 'none' });
    const sock = socketWith(noneToken);
    const err = await run(sock);
    expect(err).toBeInstanceOf(Error);
    expect(sock.data.userId).toBeUndefined();
  });
});

describe('scheduler.extra: cron reconciliation extras', () => {
  it('unregisters stale ids while keeping wanted ones', async () => {
    const userId = await seedUser('a@t.com');
    const projectId = await seedProject(userId);
    const s = await createSchedule(userId, {
      projectId,
      kind: 'backup',
      cron: '0 3 * * *',
    });
    const registered = new Set<string>(['stale-id-999']);
    const unregistered: string[] = [];
    const cron: SchedulerCron = {
      register: (id) => {
        registered.add(id);
      },
      unregister: (id) => {
        registered.delete(id);
        unregistered.push(id);
      },
      list: () => Array.from(registered),
      clear: () => registered.clear(),
    };
    const queue = new MemoryQueue();
    queue.setProcessor(async () => {});
    await reconcileCron({ cron, queue, entitlements: allowAllEntitlements });
    expect(unregistered).toEqual(['stale-id-999']);
    expect(registered.has(s._id.toString())).toBe(true);
  });

  it('enqueueFromSchedule handles a schedule with no retention policy', async () => {
    const added: Array<Record<string, unknown>> = [];
    const queue: SchedulerQueue = {
      async add(data) {
        added.push(data as unknown as Record<string, unknown>);
        return { id: '1', data, attempts: 0 };
      },
      async activeCountForProject() {
        return 0;
      },
      async waitIdle() {},
      async close() {},
    };
    const save = vi.fn(async () => undefined);
    const fakeSchedule = {
      _id: { toString: () => 'sched-1' },
      owner: { toString: () => 'owner-1' },
      project: { toString: () => 'proj-1' },
      kind: 'check' as const,
      retention: undefined,
      lastEnqueuedAt: null as Date | null,
      lastRunStatus: 'idle',
      save,
    };
    await enqueueFromSchedule(fakeSchedule as never, {
      queue,
      entitlements: allowAllEntitlements,
    });
    expect(added[0]?.retention).toBeUndefined();
    expect(save).toHaveBeenCalledOnce();
  });
});

describe('scheduler.extra: restore enqueue validates targetPath against the project allowlist', () => {
  function captureQueue(): { queue: SchedulerQueue; added: Array<{ payload?: unknown }> } {
    const added: Array<{ payload?: unknown }> = [];
    const queue: SchedulerQueue = {
      async add(data) {
        added.push(data as { payload?: unknown });
        return { id: '1', data, attempts: 0 };
      },
      async activeCountForProject() {
        return 0;
      },
      async waitIdle() {},
      async close() {},
    };
    return { queue, added };
  }

  it('accepts a /var/www target for a local project and rejects one outside', async () => {
    const userId = await seedUser('rt1@t.com');
    const projectId = await seedProject(userId);
    const { queue, added } = captureQueue();
    const deps = { queue, entitlements: allowAllEntitlements };

    await enqueueNow(
      userId,
      {
        projectId,
        kind: 'restore',
        snapshotId: 'latest',
        overwrite: false,
        targetPath: '/var/www/restore-here',
      },
      deps,
    );
    expect(added[0]?.payload).toMatchObject({ targetPath: '/var/www/restore-here' });

    await expect(
      enqueueNow(
        userId,
        {
          projectId,
          kind: 'restore',
          snapshotId: 'latest',
          overwrite: false,
          targetPath: '/root/.ssh',
        },
        deps,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('skips target validation for overwrite restores (restic restores original paths)', async () => {
    const userId = await seedUser('rt2@t.com');
    const projectId = await seedProject(userId);
    const { queue, added } = captureQueue();

    await enqueueNow(
      userId,
      { projectId, kind: 'restore', snapshotId: 'latest', overwrite: true },
      { queue, entitlements: allowAllEntitlements },
    );
    expect(added[0]?.payload).toMatchObject({ overwrite: true });
  });

  it("validates against the assigned agent's reported roots", async () => {
    const userId = await seedUser('rt3@t.com');
    const { registerAgent, touchAgentHeartbeat } = await import(
      '../agents/agents.service.js'
    );
    const { agent } = await registerAgent(userId, { name: 'v', host: 'rt3.example' });
    await touchAgentHeartbeat(String(agent._id), {
      discovery: {
        folders: [],
        containers: [],
        dockerAvailable: true,
        roots: ['/opt/projects'],
        errors: [],
      },
    });
    const p = await createProject(userId, {
      name: 'agent-proj',
      path: '/opt/projects/shop',
      repoPassword: 'password1',
      agentId: String(agent._id),
    });
    const { queue, added } = captureQueue();
    const deps = { queue, entitlements: allowAllEntitlements };

    await enqueueNow(
      userId,
      {
        projectId: String(p._id),
        kind: 'restore',
        snapshotId: 'latest',
        overwrite: false,
        targetPath: '/opt/projects/restore-here',
      },
      deps,
    );
    expect(added[0]?.payload).toMatchObject({ targetPath: '/opt/projects/restore-here' });

    await expect(
      enqueueNow(
        userId,
        {
          projectId: String(p._id),
          kind: 'restore',
          snapshotId: 'latest',
          overwrite: false,
          targetPath: '/var/www/elsewhere',
        },
        deps,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('scheduler.extra: restore enqueue with a missing targetPath (service-direct)', () => {
  it('rejects overwrite:false with no targetPath at all', async () => {
    const userId = await seedUser('rt4@t.com');
    const projectId = await seedProject(userId);
    const queue: SchedulerQueue = {
      async add(data) {
        return { id: '1', data, attempts: 0 };
      },
      async activeCountForProject() {
        return 0;
      },
      async waitIdle() {},
      async close() {},
    };
    await expect(
      enqueueNow(
        userId,
        { projectId, kind: 'restore', snapshotId: 'latest', overwrite: false },
        { queue, entitlements: allowAllEntitlements },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
