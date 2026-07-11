import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';

// Runs in OSS self-host mode (PAYMENT_PROVIDER=none) so schedule creation is
// unrestricted — billing tiering itself is covered by the billing suites.
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
import { Schedule } from './scheduler.model.js';
import { MemoryQueue } from './scheduler.queue.memory.js';
import { reconcileCron } from './scheduler.cron.js';
import { allowAllEntitlements } from './scheduler.entitlements.js';
import {
  createSchedule,
  ensureDefaultBackupSchedule,
  DEFAULT_BACKUP_CRON,
} from './scheduler.service.js';

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

// Regression suite for the thakaat-project incident (2026-07): projects were
// created without any backup schedule, so nothing ever backed them up and the
// heartbeat alert fired daily. Two invariants pinned here:
//   1. project creation provisions a default daily backup schedule, and
//   2. schedules arm via periodic reconcile — never boot-only registration.
describe('scheduler: default backup schedule provisioning', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });
  afterAll(async () => {
    await stopMemoryMongo();
  });
  beforeEach(async () => {
    await clearCollections();
  });

  it('provisions a daily backup schedule for a project without one', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);

    const schedule = await ensureDefaultBackupSchedule(a.id, projectId);

    expect(schedule).not.toBeNull();
    expect(schedule?.kind).toBe('backup');
    expect(schedule?.cron).toBe(DEFAULT_BACKUP_CRON);
    expect(schedule?.enabled).toBe(true);
    expect(await Schedule.countDocuments({ project: projectId })).toBe(1);
  });

  it('is idempotent — returns the existing backup schedule, no duplicate', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    const existing = await createSchedule(a.id, {
      projectId,
      kind: 'backup',
      cron: '0 5 * * *',
    });

    const schedule = await ensureDefaultBackupSchedule(a.id, projectId);

    expect(schedule?._id.toString()).toBe(existing._id.toString());
    expect(schedule?.cron).toBe('0 5 * * *');
    expect(await Schedule.countDocuments({ project: projectId })).toBe(1);
  });

  it('never throws — a failing provision returns null and creates nothing', async () => {
    const a = await seedUser('a@t.com');
    const foreignProjectId = new mongoose.Types.ObjectId().toString();

    const schedule = await ensureDefaultBackupSchedule(a.id, foreignProjectId);

    expect(schedule).toBeNull();
    expect(await Schedule.countDocuments({})).toBe(0);
  });

  it('POST /api/backups provisions the default schedule with the project', async () => {
    const { id, token } = await seedUser('a@t.com');
    const res = await request(app)
      .post('/api/backups')
      .set('Authorization', `JWT ${token}`)
      .send({ name: 'demo', path: '/var/www/demo', repoPassword: 'super-secret-pw' });

    expect(res.status).toBe(201);
    const schedule = await Schedule.findOne({
      project: res.body.project.id,
      owner: id,
      kind: 'backup',
    });
    expect(schedule).not.toBeNull();
    expect(schedule?.cron).toBe(DEFAULT_BACKUP_CRON);
    expect(schedule?.enabled).toBe(true);
  });

  it('reconcileCron arms schedules created after boot and never sweeps system tasks', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);

    const triggers = new Map<string, () => Promise<void>>();
    const unregistered: string[] = [];
    const cron = {
      register: (id: string, _expr: string, run: () => Promise<void>): void => {
        triggers.set(id, run);
      },
      unregister: vi.fn((id: string) => {
        unregistered.push(id);
        triggers.delete(id);
      }),
      list: () => Array.from(triggers.keys()),
      clear: () => triggers.clear(),
    };
    const queue = new MemoryQueue();
    queue.setProcessor(async () => {});

    // Boot state: system tasks + one stale registration for a since-deleted
    // schedule. Boot-time reconcile saw no schedules.
    triggers.set('__heartbeat__', async () => {});
    triggers.set('__reconcile__', async () => {});
    const staleId = new mongoose.Types.ObjectId().toString();
    triggers.set(staleId, async () => {});

    // A schedule created AFTER boot (the incident shape: created via the API,
    // api never restarted) must arm on the next periodic reconcile pass.
    const schedule = await ensureDefaultBackupSchedule(a.id, projectId);
    await reconcileCron({ cron, queue, entitlements: allowAllEntitlements });

    expect(cron.list()).toContain(schedule?._id.toString());
    expect(unregistered).toEqual([staleId]);
    expect(cron.list()).toContain('__heartbeat__');
    expect(cron.list()).toContain('__reconcile__');
  });
});
