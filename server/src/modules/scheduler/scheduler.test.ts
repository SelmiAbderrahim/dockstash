import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { EventEmitter } from 'node:events';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';

// Feature suite runs in OSS self-host mode (PAYMENT_PROVIDER=none) so paid-tier
// entitlements (schedules) are unrestricted for schedule creation. Per-test
// entitlement DENIAL is exercised via injected hooks, not this env — billing
// tiering itself is covered by the billing suites.
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
import { createProject } from '../backups/backups.service.js';
import { verifyKeyParity } from '../../shared/i18n/index.js';
import { Schedule } from './scheduler.model.js';
import { MemoryQueue } from './scheduler.queue.memory.js';
import { NodeCronScheduler } from './scheduler.cron.node.js';
import { attachLogStream, LOG_ROOM_PREFIX } from './scheduler.logstream.js';
import { recoverStaleLockIfOrphaned } from './scheduler.lock.js';
import { runPrune, pruneArgs } from './scheduler.prune.service.js';
import { dispatchJob, processJob } from './scheduler.dispatcher.js';
import { reconcileCron } from './scheduler.cron.js';
import { allowAllEntitlements } from './scheduler.entitlements.js';
import {
  createSchedule,
  loadOwnedSchedule,
  updateSchedule,
  deleteSchedule,
  listSchedulesForUser,
} from './scheduler.service.js';
import {
  configureSchedulerController,
  resetSchedulerController,
} from './scheduler.controller.js';
import { serializeSchedule } from './scheduler.serialize.js';
import type {
  AlertHook,
  LogEmitter,
  ResticRunnerExt,
  SchedulerQueue,
} from './scheduler.boundaries.js';
import type { DockerClient } from '../backups/backups.boundaries.js';
import { Readable } from 'node:stream';

const app = createApp();

function signToken(userId: string): string {
  return jwt.sign({ _id: userId, id: userId }, env.JWT_SECRET, { expiresIn: '1h' });
}

async function seedUser(email: string): Promise<{ id: string; token: string }> {
  const u = await User.create({
    email,
    password: 'irrelevant',
    profile: { firstName: 'S', lastName: 'U' },
    emailVerified: true,
  });
  return { id: u._id.toString(), token: signToken(u._id.toString()) };
}

async function seedProject(userId: string): Promise<string> {
  const p = await createProject(userId, {
    name: 'p',
    path: '/var/www/p',
    repoPassword: 'password1',
  });
  return p._id.toString();
}

function makeRestic(overrides: Partial<ResticRunnerExt> = {}): ResticRunnerExt & {
  calls: { name: string; args?: string[] }[];
} {
  const calls: { name: string; args?: string[] }[] = [];
  const base: ResticRunnerExt = {
    async init() {
      calls.push({ name: 'init' });
    },
    async backup(args, opts) {
      calls.push({ name: 'backup', args });
      if (opts?.stdin) opts.stdin.resume();
    },
    async snapshots() {
      calls.push({ name: 'snapshots' });
      return [];
    },
    async check(args) {
      calls.push({ name: 'check', args });
    },
    async restore(args) {
      calls.push({ name: 'restore', args });
    },
    async unlock() {
      calls.push({ name: 'unlock' });
    },
    async forget(args) {
      calls.push({ name: 'forget', args });
    },
  };
  return Object.assign(base, overrides, { calls }) as ResticRunnerExt & {
    calls: { name: string; args?: string[] }[];
  };
}

function makeDocker(): DockerClient {
  return {
    async exec() {
      return Readable.from(['dump-bytes']);
    },
    async inspect(container) {
      return { id: container, running: true };
    },
    async listContainers() {
      return [];
    },
  };
}

describe('scheduler: model + zod schemas', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });
  afterAll(async () => {
    await stopMemoryMongo();
  });
  beforeEach(async () => {
    await clearCollections();
  });

  it('rejects an invalid cron at create', async () => {
    const { token } = await seedUser('a@t.com');
    const res = await request(app)
      .post('/api/scheduler/schedules')
      .set('Authorization', `JWT ${token}`)
      .send({ projectId: '000000000000000000000000', kind: 'backup', cron: 'not-a-cron' });
    expect(res.status).toBe(400);
  });

  it('rejects non-owner project on create', async () => {
    const a = await seedUser('a@t.com');
    const b = await seedUser('b@t.com');
    const projectId = await seedProject(a.id);
    const res = await request(app)
      .post('/api/scheduler/schedules')
      .set('Authorization', `JWT ${b.token}`)
      .send({ projectId, kind: 'backup', cron: '0 3 * * *' });
    expect(res.status).toBe(403);
  });

  it('creates + lists + updates + deletes a schedule', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    const created = await createSchedule(a.id, {
      projectId,
      kind: 'backup',
      cron: '0 3 * * *',
    });
    expect(created.enabled).toBe(true);
    const list = await listSchedulesForUser(a.id);
    expect(list).toHaveLength(1);
    const updated = await updateSchedule(created._id.toString(), a.id, {
      cron: '0 4 * * *',
      enabled: false,
      retention: { keepDaily: 3 },
    });
    expect(updated.cron).toBe('0 4 * * *');
    expect(updated.enabled).toBe(false);
    expect(updated.retention.keepDaily).toBe(3);
    await deleteSchedule(created._id.toString(), a.id);
    expect(await Schedule.findById(created._id)).toBeNull();
  });

  it('serializeSchedule shapes the public payload', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    const s = await createSchedule(a.id, {
      projectId,
      kind: 'check',
      cron: '0 2 * * *',
    });
    const pub = serializeSchedule(s);
    expect(pub).toMatchObject({
      projectId,
      kind: 'check',
      cron: '0 2 * * *',
      enabled: true,
    });
    expect(pub.id).toBe(s._id.toString());
    expect(pub.lastEnqueuedAt).toBeNull();
  });

  it('403s cross-user loadOwnedSchedule / update / delete', async () => {
    const a = await seedUser('a@t.com');
    const b = await seedUser('b@t.com');
    const projectId = await seedProject(a.id);
    const s = await createSchedule(a.id, {
      projectId,
      kind: 'backup',
      cron: '0 3 * * *',
    });
    await expect(loadOwnedSchedule(s._id.toString(), b.id)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      updateSchedule(s._id.toString(), b.id, { cron: '0 5 * * *' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(deleteSchedule(s._id.toString(), b.id)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('404s missing schedule', async () => {
    const a = await seedUser('a@t.com');
    await expect(
      loadOwnedSchedule('507f1f77bcf86cd799439011', a.id),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('scheduler: prune argv mapping', () => {
  it('maps a retention policy to forget --prune flags', () => {
    expect(pruneArgs({ keepDaily: 7, keepWeekly: 4, keepMonthly: 6 })).toEqual([
      'forget',
      '--prune',
      '--keep-daily',
      '7',
      '--keep-weekly',
      '4',
      '--keep-monthly',
      '6',
    ]);
  });

  it('appends continuous keeps only when set and > 0', () => {
    expect(
      pruneArgs({ keepDaily: 7, keepWeekly: 4, keepMonthly: 6, keepHourly: 24, keepLast: 12 }),
    ).toEqual([
      'forget',
      '--prune',
      '--keep-daily',
      '7',
      '--keep-weekly',
      '4',
      '--keep-monthly',
      '6',
      '--keep-hourly',
      '24',
      '--keep-last',
      '12',
    ]);
    // 0 = legacy behaviour: flag omitted entirely.
    expect(
      pruneArgs({ keepDaily: 1, keepWeekly: 1, keepMonthly: 1, keepHourly: 0, keepLast: 0 }),
    ).toEqual([
      'forget',
      '--prune',
      '--keep-daily',
      '1',
      '--keep-weekly',
      '1',
      '--keep-monthly',
      '1',
    ]);
  });
});

describe('scheduler: dispatcher (per-kind + prune separation)', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });
  afterAll(async () => {
    await stopMemoryMongo();
  });
  beforeEach(async () => {
    await clearCollections();
  });

  it('backup job NEVER calls forget --prune', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    const restic = makeRestic();
    await dispatchJob(
      {
        id: '1',
        attempts: 1,
        data: { projectId, owner: a.id, kind: 'backup' },
      },
      { resticRunner: restic, dockerClient: makeDocker() },
    );
    expect(restic.calls.some((c) => c.name === 'forget')).toBe(false);
  });

  it('prune job calls forget --prune with mapped flags', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    const restic = makeRestic();
    await runPrune(
      projectId,
      a.id,
      { keepDaily: 5, keepWeekly: 3, keepMonthly: 2 },
      { resticRunner: restic },
    );
    const forgetCall = restic.calls.find((c) => c.name === 'forget');
    expect(forgetCall?.args).toEqual([
      'forget',
      '--prune',
      '--keep-daily',
      '5',
      '--keep-weekly',
      '3',
      '--keep-monthly',
      '2',
    ]);
  });

  it('prune clamps the policy through an injected tier clamp', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    const restic = makeRestic();
    await runPrune(
      projectId,
      a.id,
      { keepDaily: 30, keepWeekly: 10, keepMonthly: 12 },
      {
        resticRunner: restic,
        clampPolicy: async () => ({ keepDaily: 7, keepWeekly: 1, keepMonthly: 1 }),
      },
    );
    const forgetCall = restic.calls.find((c) => c.name === 'forget');
    expect(forgetCall?.args).toEqual([
      'forget',
      '--prune',
      '--keep-daily',
      '7',
      '--keep-weekly',
      '1',
      '--keep-monthly',
      '1',
    ]);
  });

  it('prune surfaces a localized error on failure', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    const restic = makeRestic({
      async forget() {
        throw new Error('lock held');
      },
    });
    await expect(
      runPrune(projectId, a.id, { keepDaily: 7, keepWeekly: 4, keepMonthly: 6 }, {
        resticRunner: restic,
      }),
    ).rejects.toMatchObject({ status: 500 });
  });

  it('dispatch: check kind calls restic check', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    const restic = makeRestic();
    await dispatchJob(
      { id: '1', attempts: 1, data: { projectId, owner: a.id, kind: 'check' } },
      { resticRunner: restic },
    );
    expect(restic.calls.some((c) => c.name === 'check')).toBe(true);
  });

  it('dispatch: drill requires scratch/fileDiff/dbDiff', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    const restic = makeRestic();
    await expect(
      dispatchJob(
        { id: '1', attempts: 1, data: { projectId, owner: a.id, kind: 'drill' } },
        { resticRunner: restic },
      ),
    ).rejects.toThrow(/requires/);
  });

  it('dispatch: backup requires dockerClient', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    const restic = makeRestic();
    await expect(
      dispatchJob(
        { id: '1', attempts: 1, data: { projectId, owner: a.id, kind: 'backup' } },
        { resticRunner: restic },
      ),
    ).rejects.toThrow(/requires/);
  });

  it('dispatch: prune requires retention', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    const restic = makeRestic();
    await expect(
      dispatchJob(
        { id: '1', attempts: 1, data: { projectId, owner: a.id, kind: 'prune' } },
        { resticRunner: restic },
      ),
    ).rejects.toThrow(/retention/);
  });

  it('dispatch: prune with retention calls forget', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    const restic = makeRestic();
    await dispatchJob(
      {
        id: '1',
        attempts: 1,
        data: {
          projectId,
          owner: a.id,
          kind: 'prune',
          retention: { keepDaily: 1, keepWeekly: 1, keepMonthly: 1 },
        },
      },
      { resticRunner: restic },
    );
    expect(restic.calls.some((c) => c.name === 'forget')).toBe(true);
  });
});

describe('scheduler: MemoryQueue — one job per repo, parallel across repos', () => {
  it('serializes jobs on the same repo, runs different repos in parallel', async () => {
    const queue = new MemoryQueue();
    const order: string[] = [];
    let overlapSameRepo = 0;
    const activeByRepo = new Map<string, number>();

    const gates = new Map<string, () => void>();
    const wait = (id: string): Promise<void> =>
      new Promise((resolve) => gates.set(id, resolve));

    queue.setProcessor(async (job) => {
      const proj = job.data.projectId;
      const active = (activeByRepo.get(proj) ?? 0) + 1;
      activeByRepo.set(proj, active);
      if (active > 1) overlapSameRepo++;
      order.push(`start:${job.id}`);
      await wait(job.id);
      order.push(`end:${job.id}`);
      activeByRepo.set(proj, active - 1);
    });

    const j1 = await queue.add({ projectId: 'A', owner: 'u', kind: 'backup' });
    const j2 = await queue.add({ projectId: 'A', owner: 'u', kind: 'check' });
    const j3 = await queue.add({ projectId: 'B', owner: 'u', kind: 'backup' });

    await new Promise((r) => setTimeout(r, 10));
    // j1 and j3 must be running (different repos), j2 must be waiting
    expect(order.includes(`start:${j1.id}`)).toBe(true);
    expect(order.includes(`start:${j3.id}`)).toBe(true);
    expect(order.includes(`start:${j2.id}`)).toBe(false);

    gates.get(j1.id)?.();
    await new Promise((r) => setTimeout(r, 10));
    expect(order.includes(`start:${j2.id}`)).toBe(true);

    gates.get(j2.id)?.();
    gates.get(j3.id)?.();
    await queue.waitIdle();

    expect(overlapSameRepo).toBe(0);
    await queue.close();
  });

  it('active count reflects running jobs; close is idempotent', async () => {
    const queue = new MemoryQueue();
    queue.setProcessor(async () => {
      // noop
    });
    const j = await queue.add({ projectId: 'X', owner: 'u', kind: 'check' });
    await queue.waitIdle();
    expect(await queue.activeCountForProject('X')).toBe(0);
    await queue.close();
    await expect(
      queue.add({ projectId: 'X', owner: 'u', kind: 'check' }),
    ).rejects.toThrow(/closed/);
    expect(j.id).toBeTruthy();
  });

  it('rejects add when processor is unset', async () => {
    const queue = new MemoryQueue();
    await expect(
      queue.add({ projectId: 'X', owner: 'u', kind: 'check' }),
    ).rejects.toThrow(/processor/);
  });
});

describe('scheduler: stale-lock recovery', () => {
  it('unlocks when the job is the only active one', async () => {
    const restic = makeRestic();
    const queue: SchedulerQueue = {
      async add() {
        throw new Error('unused');
      },
      async activeCountForProject() {
        return 1;
      },
      async waitIdle() {},
      async close() {},
    };
    const res = await recoverStaleLockIfOrphaned(
      { id: '1', attempts: 2, data: { projectId: 'A', owner: 'u', kind: 'backup' } },
      { queue, resticRunner: restic },
    );
    expect(res.unlocked).toBe(true);
    expect(restic.calls.some((c) => c.name === 'unlock')).toBe(true);
  });

  it('does NOT unlock when a live job holds the repo', async () => {
    const restic = makeRestic();
    const queue: SchedulerQueue = {
      async add() {
        throw new Error('unused');
      },
      async activeCountForProject() {
        return 2;
      },
      async waitIdle() {},
      async close() {},
    };
    const res = await recoverStaleLockIfOrphaned(
      { id: '1', attempts: 2, data: { projectId: 'A', owner: 'u', kind: 'backup' } },
      { queue, resticRunner: restic },
    );
    expect(res.unlocked).toBe(false);
    expect(restic.calls.some((c) => c.name === 'unlock')).toBe(false);
  });

  it('swallows unlock errors', async () => {
    const restic = makeRestic({
      async unlock() {
        throw new Error('nope');
      },
    });
    const queue: SchedulerQueue = {
      async add() {
        throw new Error('unused');
      },
      async activeCountForProject() {
        return 1;
      },
      async waitIdle() {},
      async close() {},
    };
    const res = await recoverStaleLockIfOrphaned(
      { id: '1', attempts: 2, data: { projectId: 'A', owner: 'u', kind: 'backup' } },
      { queue, resticRunner: restic },
    );
    expect(res.unlocked).toBe(false);
  });
});

describe('scheduler: processJob retry + backoff + alert hook', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });
  afterAll(async () => {
    await stopMemoryMongo();
  });
  beforeEach(async () => {
    await clearCollections();
  });

  it('retries up to the cap with growing backoff, then alerts on final failure', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    let attempts = 0;
    const restic = makeRestic({
      async forget() {
        attempts++;
        throw new Error(`boom-${attempts}`);
      },
    });
    const backoffs: number[] = [];
    const queue = new MemoryQueue();
    queue.setProcessor(async () => {});
    const alert: AlertHook = { onFailed: vi.fn(async () => undefined) };
    const logs: LogEmitter = { log: vi.fn(), done: vi.fn() };

    await expect(
      processJob(
        {
          id: '1',
          attempts: 0,
          data: {
            projectId,
            owner: a.id,
            kind: 'prune',
            retention: { keepDaily: 1, keepWeekly: 1, keepMonthly: 1 },
          },
        },
        {
          resticRunner: restic,
          queue,
          logs,
          alert,
          maxAttempts: 3,
          baseBackoffMs: 10,
          sleep: async (ms) => {
            backoffs.push(ms);
          },
        },
      ),
    ).rejects.toThrow(/boom-3/);

    expect(attempts).toBe(3);
    expect(backoffs).toEqual([10, 20]);
    expect(alert.onFailed).toHaveBeenCalledOnce();
    expect(logs.done).toHaveBeenCalledWith('1', false, expect.any(String));
  });

  it('succeeds on first attempt → done ok, no alert', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    const restic = makeRestic();
    const queue = new MemoryQueue();
    queue.setProcessor(async () => {});
    const alert: AlertHook = { onFailed: vi.fn(async () => undefined) };
    const logs: LogEmitter = { log: vi.fn(), done: vi.fn() };

    await processJob(
      { id: '9', attempts: 0, data: { projectId, owner: a.id, kind: 'check' } },
      { resticRunner: restic, queue, logs, alert, maxAttempts: 3, baseBackoffMs: 1 },
    );
    expect(alert.onFailed).not.toHaveBeenCalled();
    expect(logs.done).toHaveBeenCalledWith('9', true);
  });

  it('swallows alert-hook errors so job failure is still surfaced', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    const restic = makeRestic({
      async forget() {
        throw new Error('inner');
      },
    });
    const queue = new MemoryQueue();
    queue.setProcessor(async () => {});
    const alert: AlertHook = {
      onFailed: async () => {
        throw new Error('alert broke');
      },
    };
    await expect(
      processJob(
        {
          id: '2',
          attempts: 0,
          data: {
            projectId,
            owner: a.id,
            kind: 'prune',
            retention: { keepDaily: 1, keepWeekly: 1, keepMonthly: 1 },
          },
        },
        {
          resticRunner: restic,
          queue,
          alert,
          maxAttempts: 1,
          sleep: async () => undefined,
        },
      ),
    ).rejects.toThrow(/inner/);
  });

  it('persists lastRunStatus success on the schedule when scheduleId is present', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    const schedule = await createSchedule(a.id, {
      projectId,
      kind: 'check',
      cron: '0 3 * * *',
    });
    const restic = makeRestic();
    const queue = new MemoryQueue();
    queue.setProcessor(async () => {});
    await processJob(
      {
        id: '1',
        attempts: 0,
        data: {
          projectId,
          owner: a.id,
          kind: 'check',
          scheduleId: schedule._id.toString(),
        },
      },
      { resticRunner: restic, queue, maxAttempts: 1 },
    );
    const reloaded = await Schedule.findById(schedule._id);
    expect(reloaded?.lastRunStatus).toBe('success');
  });
});

describe('scheduler: cron reconciliation + entitlements', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });
  afterAll(async () => {
    await stopMemoryMongo();
  });
  beforeEach(async () => {
    await clearCollections();
  });

  it('reconcileCron: registers one entry per enabled schedule; unregisters disabled', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    const s1 = await createSchedule(a.id, {
      projectId,
      kind: 'backup',
      cron: '0 3 * * *',
    });
    const s2 = await createSchedule(a.id, {
      projectId,
      kind: 'check',
      cron: '0 4 * * *',
    });
    // manually disable s2
    s2.enabled = false;
    await s2.save();

    const registrations: string[] = [];
    const triggers = new Map<string, () => Promise<void>>();
    const cron = {
      register: (id: string, _expr: string, run: () => Promise<void>): void => {
        registrations.push(id);
        triggers.set(id, run);
      },
      unregister: vi.fn(),
      list: () => Array.from(triggers.keys()),
      clear: () => triggers.clear(),
    };
    const queue = new MemoryQueue();
    queue.setProcessor(async () => {});
    await reconcileCron({ cron, queue, entitlements: allowAllEntitlements });
    expect(registrations).toEqual([s1._id.toString()]);
  });

  it('cron trigger enqueues a job; entitlement denial is respected', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    const s = await createSchedule(a.id, {
      projectId,
      kind: 'backup',
      cron: '0 3 * * *',
    });
    const triggers = new Map<string, () => Promise<void>>();
    const cron = {
      register: (id: string, _e: string, run: () => Promise<void>): void => {
        triggers.set(id, run);
      },
      unregister: () => {},
      list: () => Array.from(triggers.keys()),
      clear: () => triggers.clear(),
    };
    const enqueued: string[] = [];
    const queue: SchedulerQueue = {
      async add(data) {
        enqueued.push(data.projectId);
        return { id: String(enqueued.length), data, attempts: 0 };
      },
      async activeCountForProject() {
        return 0;
      },
      async waitIdle() {},
      async close() {},
    };
    const denyAll = {
      async canEnqueue() {
        return false;
      },
    };

    await reconcileCron({ cron, queue, entitlements: denyAll });
    const runDeny = triggers.get(s._id.toString());
    expect(runDeny).toBeTruthy();
    await runDeny?.();
    expect(enqueued).toHaveLength(0);

    triggers.clear();
    await reconcileCron({ cron, queue, entitlements: allowAllEntitlements });
    await triggers.get(s._id.toString())?.();
    expect(enqueued).toEqual([projectId]);
    const reloaded = await Schedule.findById(s._id);
    expect(reloaded?.lastRunStatus).toBe('queued');
  });

  it('NodeCronScheduler idempotently registers and unregisters', () => {
    const cron = new NodeCronScheduler();
    cron.register('a', '* * * * *', async () => {});
    cron.register('a', '* * * * *', async () => {});
    expect(cron.list()).toEqual(['a']);
    cron.unregister('a');
    expect(cron.list()).toEqual([]);
    cron.unregister('missing');
    cron.register('b', '* * * * *', async () => {});
    cron.clear();
    expect(cron.list()).toEqual([]);
  });
});

describe('scheduler: HTTP routes (auth + ownership + enqueue)', () => {
  const localQueue = new MemoryQueue();
  localQueue.setProcessor(async () => {});
  const enqueueCalls: string[] = [];
  const trackingQueue: SchedulerQueue = {
    async add(data) {
      enqueueCalls.push(data.kind);
      return localQueue.add(data);
    },
    activeCountForProject: (p) => localQueue.activeCountForProject(p),
    waitIdle: () => localQueue.waitIdle(),
    close: () => localQueue.close(),
  };
  let entitlementDeny = false;
  const entitlements = {
    canEnqueue: async () => !entitlementDeny,
  };

  beforeAll(async () => {
    await startMemoryMongo();
    configureSchedulerController({ queue: trackingQueue, entitlements });
  });
  afterAll(async () => {
    resetSchedulerController();
    await stopMemoryMongo();
  });
  beforeEach(async () => {
    await clearCollections();
    enqueueCalls.length = 0;
    entitlementDeny = false;
  });

  it('requires auth on every route', async () => {
    const paths: Array<[string, string]> = [
      ['post', '/api/scheduler/schedules'],
      ['get', '/api/scheduler/schedules'],
      ['get', '/api/scheduler/schedules/x'],
      ['patch', '/api/scheduler/schedules/x'],
      ['delete', '/api/scheduler/schedules/x'],
      ['post', '/api/scheduler/enqueue'],
    ];
    for (const [method, url] of paths) {
      const agent = request(app) as unknown as Record<string, (p: string) => request.Test>;
      const fn = agent[method];
      if (!fn) throw new Error(`unknown method ${method}`);
      const res = await fn.call(agent, url);
      expect(res.status).toBe(401);
    }
  });

  it('POST /schedules → 201, GET → 200, PATCH → 200, DELETE → 204', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    const create = await request(app)
      .post('/api/scheduler/schedules')
      .set('Authorization', `JWT ${a.token}`)
      .send({ projectId, kind: 'backup', cron: '0 3 * * *' });
    expect(create.status).toBe(201);
    const scheduleId = create.body.schedule.id;

    const list = await request(app)
      .get('/api/scheduler/schedules')
      .set('Authorization', `JWT ${a.token}`);
    expect(list.status).toBe(200);
    expect(list.body.schedules).toHaveLength(1);

    const get = await request(app)
      .get(`/api/scheduler/schedules/${scheduleId}`)
      .set('Authorization', `JWT ${a.token}`);
    expect(get.status).toBe(200);

    const patch = await request(app)
      .patch(`/api/scheduler/schedules/${scheduleId}`)
      .set('Authorization', `JWT ${a.token}`)
      .send({ enabled: false });
    expect(patch.status).toBe(200);
    expect(patch.body.schedule.enabled).toBe(false);

    const del = await request(app)
      .delete(`/api/scheduler/schedules/${scheduleId}`)
      .set('Authorization', `JWT ${a.token}`);
    expect(del.status).toBe(204);
  });

  it('rejects cross-user schedule access', async () => {
    const a = await seedUser('a@t.com');
    const b = await seedUser('b@t.com');
    const projectId = await seedProject(a.id);
    const created = await createSchedule(a.id, {
      projectId,
      kind: 'backup',
      cron: '0 3 * * *',
    });
    const res = await request(app)
      .get(`/api/scheduler/schedules/${created._id.toString()}`)
      .set('Authorization', `JWT ${b.token}`);
    expect(res.status).toBe(403);
  });

  it('POST /enqueue consults the entitlement hook; denial → 403', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    entitlementDeny = true;
    const res = await request(app)
      .post('/api/scheduler/enqueue')
      .set('Authorization', `JWT ${a.token}`)
      .send({ projectId, kind: 'backup' });
    expect(res.status).toBe(403);
    expect(enqueueCalls).toHaveLength(0);
  });

  it('POST /enqueue with scheduleId adds a job + marks schedule queued', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    const s = await createSchedule(a.id, {
      projectId,
      kind: 'prune',
      cron: '0 3 * * *',
      retention: { keepDaily: 2, keepWeekly: 1, keepMonthly: 1, keepHourly: 0, keepLast: 0 },
    });
    const res = await request(app)
      .post('/api/scheduler/enqueue')
      .set('Authorization', `JWT ${a.token}`)
      .send({ scheduleId: s._id.toString() });
    expect(res.status).toBe(202);
    expect(enqueueCalls).toEqual(['prune']);
    const reloaded = await Schedule.findById(s._id);
    expect(reloaded?.lastRunStatus).toBe('queued');
  });

  it('POST /enqueue for a missing project → 404', async () => {
    const a = await seedUser('a@t.com');
    const res = await request(app)
      .post('/api/scheduler/enqueue')
      .set('Authorization', `JWT ${a.token}`)
      .send({ projectId: '507f1f77bcf86cd799439011', kind: 'backup' });
    expect(res.status).toBe(404);
  });

  it('POST /enqueue for a stranger’s schedule → 403', async () => {
    const a = await seedUser('a@t.com');
    const b = await seedUser('b@t.com');
    const projectId = await seedProject(a.id);
    const s = await createSchedule(a.id, {
      projectId,
      kind: 'backup',
      cron: '0 3 * * *',
    });
    const res = await request(app)
      .post('/api/scheduler/enqueue')
      .set('Authorization', `JWT ${b.token}`)
      .send({ scheduleId: s._id.toString() });
    expect(res.status).toBe(403);
  });
});

describe('scheduler: log-stream socket scoping', () => {
  interface FakeSocket extends EventEmitter {
    handshake: { auth: { token?: string }; headers: Record<string, string> };
    data: { userId?: string };
    rooms: Set<string>;
    join(room: string): Promise<void>;
  }

  function makeFakeIo(): {
    io: { of: (ns: string) => FakeNamespace };
    ns: FakeNamespace;
    connect(sock: FakeSocket): void;
  } {
    let nsInstance: FakeNamespace | null = null;
    const io = {
      of(_name: string): FakeNamespace {
        if (!nsInstance) nsInstance = new FakeNamespace();
        return nsInstance;
      },
    };
    return {
      io,
      get ns() {
        return io.of('/scheduler');
      },
      connect(sock: FakeSocket) {
        const ns = io.of('/scheduler');
        ns.runMiddleware(sock).then((ok) => {
          if (ok) ns.emit('connection', sock);
        });
      },
    };
  }

  class FakeNamespace extends EventEmitter {
    private middleware: ((sock: FakeSocket, next: (err?: Error) => void) => void)[] = [];
    public emitted: { room: string; event: string; payload: unknown }[] = [];

    use(fn: (sock: FakeSocket, next: (err?: Error) => void) => void): void {
      this.middleware.push(fn);
    }

    to(room: string): { emit: (event: string, payload: unknown) => void } {
      return {
        emit: (event, payload) => {
          this.emitted.push({ room, event, payload });
        },
      };
    }

    async runMiddleware(sock: FakeSocket): Promise<boolean> {
      for (const fn of this.middleware) {
        const err = await new Promise<Error | undefined>((resolve) => {
          fn(sock, (e) => resolve(e));
        });
        if (err) return false;
      }
      return true;
    }
  }

  function fakeSocket(token?: string): FakeSocket {
    const em = new EventEmitter() as FakeSocket;
    em.handshake = { auth: { token }, headers: {} };
    em.data = {};
    em.rooms = new Set();
    em.join = async (room) => {
      em.rooms.add(room);
    };
    return em;
  }

  it('rejects connect with no token', async () => {
    const { io, connect } = makeFakeIo();
    attachLogStream({
      io: io as never,
      ownership: {
        async ownerOf() {
          return null;
        },
      },
    });
    const sock = fakeSocket();
    connect(sock);
    await new Promise((r) => setImmediate(r));
    expect(sock.data.userId).toBeUndefined();
  });

  it('rejects connect with bad token', async () => {
    const { io, connect } = makeFakeIo();
    attachLogStream({
      io: io as never,
      ownership: {
        async ownerOf() {
          return null;
        },
      },
    });
    const sock = fakeSocket('junk');
    connect(sock);
    await new Promise((r) => setImmediate(r));
    expect(sock.data.userId).toBeUndefined();
  });

  it('emits log to the room; owner joins; non-owner denied', async () => {
    const owner = 'owner-1';
    const other = 'other-2';
    const { io, ns, connect } = makeFakeIo();
    const emitter = attachLogStream({
      io: io as never,
      ownership: {
        async ownerOf(jobId) {
          return jobId === 'job-A' ? owner : null;
        },
      },
    });

    const ownerToken = jwt.sign({ id: owner }, env.JWT_SECRET);
    const otherToken = jwt.sign({ id: other }, env.JWT_SECRET);
    const ownerSock = fakeSocket(ownerToken);
    const otherSock = fakeSocket(otherToken);

    connect(ownerSock);
    connect(otherSock);
    await new Promise((r) => setImmediate(r));

    const ownerAck = vi.fn();
    ownerSock.emit('join', { jobId: 'job-A' }, ownerAck);
    await new Promise((r) => setImmediate(r));
    expect(ownerAck).toHaveBeenCalledWith({ ok: true, room: `${LOG_ROOM_PREFIX}:job-A` });
    expect(ownerSock.rooms.has(`${LOG_ROOM_PREFIX}:job-A`)).toBe(true);

    const otherAck = vi.fn();
    otherSock.emit('join', { jobId: 'job-A' }, otherAck);
    await new Promise((r) => setImmediate(r));
    expect(otherAck).toHaveBeenCalledWith({ ok: false, reason: 'forbidden' });
    expect(otherSock.rooms.has(`${LOG_ROOM_PREFIX}:job-A`)).toBe(false);

    emitter.log('job-A', 'scanning /var/www');
    emitter.done('job-A', true);
    emitter.done('job-B', false, 'boom');

    const logEmit = ns.emitted.find(
      (e) => e.room === `${LOG_ROOM_PREFIX}:job-A` && e.event === 'log',
    );
    expect(logEmit?.payload).toMatchObject({ jobId: 'job-A', line: 'scanning /var/www' });

    const doneEmit = ns.emitted.find(
      (e) => e.room === `${LOG_ROOM_PREFIX}:job-A` && e.event === 'done',
    );
    expect(doneEmit).toBeTruthy();

    const failedEmit = ns.emitted.find(
      (e) => e.room === `${LOG_ROOM_PREFIX}:job-B` && e.event === 'failed',
    );
    expect(failedEmit?.payload).toMatchObject({ ok: false, detail: 'boom' });
  });

  it('join rejects invalid jobId payload', async () => {
    const { io, connect } = makeFakeIo();
    attachLogStream({
      io: io as never,
      ownership: {
        async ownerOf() {
          return null;
        },
      },
    });
    const token = jwt.sign({ id: 'x' }, env.JWT_SECRET);
    const sock = fakeSocket(token);
    connect(sock);
    await new Promise((r) => setImmediate(r));
    const ack = vi.fn();
    sock.emit('join', { jobId: '' }, ack);
    await new Promise((r) => setImmediate(r));
    expect(ack).toHaveBeenCalledWith({ ok: false, reason: 'invalid' });
  });
});

describe('scheduler: i18n key parity', () => {
  it('every locale exposes the same scheduler.* keys and placeholders', () => {
    const result = verifyKeyParity();
    expect(result.ok).toBe(true);
  });
});
