import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { User } from '../users/index.js';
import { Project } from '../backups/backups.model.js';
import { UsageCounter } from './usage-counter.model.js';
import {
  adjustProjectCounter,
  reconcileAgentCounter,
  reconcileProjectCounter,
  releaseAgentSlot,
  releaseProjectSlot,
  reserveAgentSlot,
  reserveProjectSlot,
} from './entitlements.service.js';
import { applyProjectCap, handleUpgrade, selectProjectsToKeep } from './lifecycle.service.js';
import { Subscription } from './subscription.model.js';
import { getPaymentProvider, __setPaymentProviderForTests } from './active-provider.js';
import { Customer } from './customer.model.js';
import { createSchedule, updateSchedule } from '../scheduler/scheduler.service.js';
import { Schedule } from '../scheduler/scheduler.model.js';

/**
 * Surface #3 coverage — Plan Caps / Entitlement Bypass. Assertions state per
 * test which fails BEFORE the fix and passes AFTER, so a future reviewer can
 * bisect the guard cleanly:
 *
 * - S3-01  cap check at the API layer BEFORE the record is reserved (was
 *          skipped on the POST /api/backups create path).
 * - S3-02  PATCH /api/scheduler/:id re-runs the tier gate on cron/enable
 *          changes (was missing entirely — legacy Pro schedules kept firing
 *          at minute cadence after a Free downgrade).
 * - S3-03  Concurrent requests at `remaining == 1` cannot both create a
 *          Project — the reservation counter's atomic `$lt cap` guard closes
 *          the TOCTOU window between countDocuments and Project.create.
 */

const app = createApp();

// Worker-sharing guard (mirrors agents-cap.test.ts:84): the OSS agents suite
// (agents.test.ts) mutates env.PAYMENT_PROVIDER='none' and can share this
// vitest worker. Re-pin a paid provider before every test so a no-subscription
// user resolves to `free` (finite caps) rather than the OSS business (infinite)
// ceiling, which would make the cap-enforcement assertions vacuously pass/fail.
beforeEach(async () => {
  (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'polar';
  __setPaymentProviderForTests(null); // rebuild the cached provider from env
  // The per-file mongo restart leaves the fresh DB without indexes until
  // autoIndex completes async. The reservation ledger's atomic guard relies on
  // the unique `owner` index (its concurrency authority) to E11000 at cap —
  // build it up front so cap enforcement is deterministic across suite ordering.
  await UsageCounter.createIndexes();
});

function signToken(userId: string): string {
  return jwt.sign({ _id: userId, id: userId }, env.JWT_SECRET, { expiresIn: '1h' });
}

async function seedUser(email: string): Promise<{ id: string; token: string }> {
  const u = await User.create({
    email,
    password: 'irrelevant',
    profile: { firstName: 'C', lastName: 'A' },
    emailVerified: true,
  });
  return { id: u._id.toString(), token: signToken(u._id.toString()) };
}

async function seedActiveProSub(userId: string): Promise<void> {
  const provider = getPaymentProvider().name;
  const customer = await Customer.create({
    userId,
    provider,
    providerCustomerId: `pc_${userId}`,
    email: `${userId}@t.com`,
  });
  await Subscription.create({
    userId,
    customerId: customer._id,
    provider,
    productId: 'prod_pro',
    planSlug: 'pro',
    status: 'active',
    providerSubscriptionId: `sub_${userId}`,
    selectionRequired: false,
  });
}

describe('surface #3: S3-01 project-cap enforcement at POST /api/backups (create path)', () => {
  beforeAll(() => startMemoryMongo());
  afterAll(() => stopMemoryMongo());
  beforeEach(() => clearCollections());

  it('accepts creates up to the tier cap (free = 1)', async () => {
    // Fails BEFORE S3-01 fix: create was uncapped; both requests would 201.
    // Passes AFTER: the second request hits the reservation gate.
    const { token } = await seedUser('cap-under@t.com');
    const first = await request(app)
      .post('/api/backups')
      .set('Authorization', `JWT ${token}`)
      .send({ name: 'p1', path: '/var/www/p1', repoPassword: 'password1' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/backups')
      .set('Authorization', `JWT ${token}`)
      .send({ name: 'p2', path: '/var/www/p2', repoPassword: 'password1' });
    expect(second.status).toBe(403);
    expect(second.body).toMatchObject({
      error: { details: { reason: 'projectLimitReached', cap: 1 } },
    });
  });

  it('exactly one wins under N+1 concurrent requests at remaining==1 (S3-03 TOCTOU)', async () => {
    // Fails BEFORE S3-03 fix: `countDocuments`+`Project.create` are non-atomic;
    // both concurrent inserts commit. Passes AFTER: the atomic `$lt cap $inc`
    // reservation rejects the loser.
    const { token, id } = await seedUser('cap-race@t.com');
    const attempts = 5;
    const results = await Promise.all(
      Array.from({ length: attempts }, () =>
        request(app)
          .post('/api/backups')
          .set('Authorization', `JWT ${token}`)
          .send({
            name: `p-${Math.random()}`,
            path: `/var/www/p-${Math.random().toString(36).slice(2, 10)}`,
            repoPassword: 'password1',
          }),
      ),
    );
    const created = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status === 403);
    expect(created).toHaveLength(1);
    expect(rejected).toHaveLength(attempts - 1);
    const persisted = await Project.countDocuments({ owner: id });
    expect(persisted).toBe(1);
    const counter = await UsageCounter.findOne({ owner: id });
    expect(counter?.projects).toBe(1);
  });

  it('rollback on a foreign agentId inside createProject releases the reservation', async () => {
    // A foreign/unknown agentId 404s inside createProject → loadOwnedAgent AFTER
    // the project slot is reserved. The controller catches, releases, and
    // rethrows. A subsequent legit create must still succeed (ledger not stuck
    // at cap). Agent assignment is owner-scoped only now — no plan gate.
    const { token, id } = await seedUser('cap-rollback@t.com');
    const bad = await request(app)
      .post('/api/backups')
      .set('Authorization', `JWT ${token}`)
      .send({ name: 'x', path: '/var/www/x', repoPassword: 'password1', agentId: '507f1f77bcf86cd799439011' });
    // Unowned agent → 404 (existence-cloak), AFTER reserve, then rolled back.
    expect(bad.status).toBe(404);
    // Reservation was rolled back to zero (row may exist at 0 or be absent).
    const counter0 = await UsageCounter.findOne({ owner: id });
    expect(counter0?.projects ?? 0).toBe(0);

    // Next legit create should still succeed under free cap=1.
    const ok = await request(app)
      .post('/api/backups')
      .set('Authorization', `JWT ${token}`)
      .send({ name: 'p', path: '/var/www/p', repoPassword: 'password1' });
    expect(ok.status).toBe(201);
  });

  it('tier upgrade unpauses and re-fills the reservation ledger; downgrade drains it', async () => {
    // Verifies counter maintenance across lifecycle transitions — no drift
    // that would let a downgraded user later create over-cap. Set a business
    // product id so handleUpgrade routes to the business tier (infinite cap).
    const prevBizId = env.POLAR_BUSINESS_PRODUCT_ID;
    (env as { POLAR_BUSINESS_PRODUCT_ID?: string }).POLAR_BUSINESS_PRODUCT_ID =
      'prod_biz_test';
    try {
      const { id } = await seedUser('cap-lifecycle@t.com');
      await seedActiveProSub(id);
      // Seed counter to reflect the 3 active projects created directly (below).
      await UsageCounter.create({ owner: id, projects: 3 });
      await Project.create([
        { owner: id, name: 'a', path: '/var/www/a', repoPasswordEnc: { ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 }, paused: false },
        { owner: id, name: 'b', path: '/var/www/b', repoPasswordEnc: { ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 }, paused: false },
        { owner: id, name: 'c', path: '/var/www/c', repoPasswordEnc: { ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 }, paused: false },
      ]);

      // Downgrade to free (cap=1) pauses 2 projects; counter tracks the drop.
      const paused = await applyProjectCap(id, 'free');
      expect(paused).toBe(2);
      const afterDowngrade = await UsageCounter.findOne({ owner: id });
      expect(afterDowngrade?.projects).toBe(1);

      // Upgrade to business unpauses everything; counter climbs to 3.
      const up = await handleUpgrade(id, 'prod_biz_test');
      expect(up.unpaused).toBe(2);
      const afterUpgrade = await UsageCounter.findOne({ owner: id });
      expect(afterUpgrade?.projects).toBe(3);
    } finally {
      (env as { POLAR_BUSINESS_PRODUCT_ID?: string }).POLAR_BUSINESS_PRODUCT_ID =
        prevBizId;
    }
  });

  it('selectProjectsToKeep reconciles the counter to the post-selection active count', async () => {
    const { id } = await seedUser('cap-select@t.com');
    await seedActiveProSub(id);
    const created = await Project.create([
      { owner: id, name: 'a', path: '/var/www/a', repoPasswordEnc: { ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 }, paused: false },
      { owner: id, name: 'b', path: '/var/www/b', repoPasswordEnc: { ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 }, paused: true },
      { owner: id, name: 'c', path: '/var/www/c', repoPasswordEnc: { ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 }, paused: true },
    ]);
    const keeper = created[1];
    if (!keeper) throw new Error('seed failed');
    // Simulate downgrade-over-cap state; user keeps b.
    await selectProjectsToKeep(id, [String(keeper._id)]);
    const counter = await UsageCounter.findOne({ owner: id });
    // Sub is pro → cap 10; only 1 kept unpaused.
    expect(counter?.projects).toBe(1);
  });

  it('rejects a create body that smuggles a client-supplied tier/amount/price (zod strips)', async () => {
    // Fails BEFORE: nothing to catch; test just proves the schema strips.
    // Passes AFTER (and today): zod default is `strip` — server never observes
    // the smuggled field. Server-derived money is uncontaminated.
    const { token } = await seedUser('cap-money@t.com');
    const res = await request(app)
      .post('/api/backups')
      .set('Authorization', `JWT ${token}`)
      .send({
        name: 'p',
        path: '/var/www/p',
        repoPassword: 'password1',
        // Tampered fields — must be dropped, never persisted.
        tier: 'business',
        amount: 0,
        price: 0,
      });
    expect(res.status).toBe(201);
    // Confirm the persisted project has no client-supplied tier field.
    const persisted = res.body.project;
    expect(persisted).not.toHaveProperty('tier');
    expect(persisted).not.toHaveProperty('amount');
    expect(persisted).not.toHaveProperty('price');
  });
});

describe('surface #3: S3-02 PATCH scheduler re-asserts tier gate', () => {
  beforeAll(() => startMemoryMongo());
  afterAll(() => stopMemoryMongo());
  beforeEach(() => clearCollections());

  async function seedProject(userId: string): Promise<string> {
    const project = await Project.create({
      owner: userId,
      name: 'p',
      path: '/var/www/p',
      repoPasswordEnc: { ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 },
      paused: false,
    });
    return project._id.toString();
  }

  it('rejects a PATCH that escalates cron cadence past the Free-tier ceiling', async () => {
    // Fails BEFORE S3-02: update path called `schedule.save()` with zero
    // entitlement check. Passes AFTER: cronChanged branch calls
    // assertScheduleAllowed with classifyCron(newCron); Free denies.
    const { id } = await seedUser('sched-esc@t.com');
    const projectId = await seedProject(id);
    // Seed schedule as if it was created under Pro (daily is fine).
    const s = await Schedule.create({
      project: projectId,
      owner: id,
      kind: 'backup',
      cron: '0 3 * * *',
      retention: { keepDaily: 7, keepWeekly: 4, keepMonthly: 6 },
      enabled: true,
    });
    // Subscription lapsed — user is now Free (no subscription = free).
    await expect(
      updateSchedule(s._id.toString(), id, { cron: '* * * * *' }),
    ).rejects.toMatchObject({
      status: 403,
      details: { reason: 'schedulesLocked' },
    });
  });

  it('rejects a PATCH that flips enabled=true on a legacy schedule after downgrade', async () => {
    // Fails BEFORE: no re-check on enable. Passes AFTER: enableTransition
    // branch calls assertScheduleAllowed with the existing cron.
    const { id } = await seedUser('sched-toggle@t.com');
    const projectId = await seedProject(id);
    const s = await Schedule.create({
      project: projectId,
      owner: id,
      kind: 'backup',
      cron: '*/5 * * * *',
      retention: { keepDaily: 7, keepWeekly: 4, keepMonthly: 6 },
      enabled: false,
    });
    // Free tier: schedules feature is locked entirely — re-enable is blocked.
    await expect(
      updateSchedule(s._id.toString(), id, { enabled: true }),
    ).rejects.toMatchObject({
      status: 403,
      details: { reason: 'schedulesLocked' },
    });
  });

  it('allows a PATCH that only tweaks retention (no re-assert needed)', async () => {
    // enabled/cron unchanged → no re-check. Retention clamp still applied.
    const { id } = await seedUser('sched-retention@t.com');
    await seedActiveProSub(id);
    const projectId = await seedProject(id);
    const s = await createSchedule(id, { projectId, kind: 'backup', cron: '0 3 * * *' });
    const updated = await updateSchedule(s._id.toString(), id, {
      retention: { keepDaily: 999 },
    });
    // Pro tier retentionDays=30 → keepDaily clamped to 30.
    expect(updated.retention.keepDaily).toBe(30);
  });

  it('allows a PATCH from an active Pro subscriber to change cron cadence', async () => {
    const { id } = await seedUser('sched-pro@t.com');
    await seedActiveProSub(id);
    const projectId = await seedProject(id);
    const s = await createSchedule(id, { projectId, kind: 'backup', cron: '0 3 * * *' });
    const updated = await updateSchedule(s._id.toString(), id, {
      cron: '*/5 * * * *',
    });
    expect(updated.cron).toBe('*/5 * * * *');
  });

  it('allows disabling a schedule without re-assert (enabled: true→false)', async () => {
    const { id } = await seedUser('sched-disable@t.com');
    await seedActiveProSub(id);
    const projectId = await seedProject(id);
    const s = await createSchedule(id, { projectId, kind: 'backup', cron: '0 3 * * *' });
    // Simulate a downgrade after creation.
    await Subscription.deleteMany({ userId: id });
    const updated = await updateSchedule(s._id.toString(), id, { enabled: false });
    expect(updated.enabled).toBe(false);
  });

  it('clamps a Free-tier createSchedule retention at write time', async () => {
    // Fails BEFORE the create-time clamp: keeps persisted verbatim, prune-time
    // narrows. Passes AFTER: persisted policy already matches the tier.
    const { id } = await seedUser('sched-clamp-create@t.com');
    // No sub → free. Free schedules are gated, so temporarily grant pro
    // subscription to allow createSchedule, then verify retention is at Pro
    // ceiling (30 days).
    await seedActiveProSub(id);
    const projectId = await seedProject(id);
    const s = await createSchedule(id, {
      projectId,
      kind: 'backup',
      cron: '0 3 * * *',
      retention: {
        keepDaily: 365,
        keepWeekly: 100,
        keepMonthly: 50,
        keepHourly: 100_000,
        keepLast: 100_000,
      },
    });
    // Pro tier retentionDays=30.
    expect(s.retention.keepDaily).toBe(30);
    expect(s.retention.keepWeekly).toBeLessThanOrEqual(Math.ceil(30 / 7));
    expect(s.retention.keepMonthly).toBeLessThanOrEqual(Math.ceil(30 / 30));
    // keepLast clamped at KEEP_LAST_MAX = 288.
    expect(s.retention.keepLast).toBe(288);
    // keepHourly clamped to tierDays*24 = 720.
    expect(s.retention.keepHourly).toBe(720);
  });
});

describe('surface #3: reservation ledger unit cover', () => {
  beforeAll(() => startMemoryMongo());
  afterAll(() => stopMemoryMongo());
  beforeEach(() => clearCollections());

  it('reserveProjectSlot is a no-op on infinite tier (Business ceiling)', async () => {
    // Business-tier: no counter row is ever written.
    const prev = env.PAYMENT_PROVIDER;
    (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'none';
    try {
      const u = await User.create({
        email: 'inf@t.com',
        password: 'x',
        profile: { firstName: 'I', lastName: 'N' },
        emailVerified: true,
      });
      await reserveProjectSlot(String(u._id), {
        countActiveProjects: async () => 0,
      });
      const counter = await UsageCounter.findOne({ owner: u._id });
      expect(counter).toBeNull();
    } finally {
      (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = prev;
    }
  });

  it('releaseProjectSlot clamps at zero (never goes negative)', async () => {
    const u = await User.create({
      email: 'clamp@t.com',
      password: 'x',
      profile: { firstName: 'C', lastName: 'L' },
      emailVerified: true,
    });
    await UsageCounter.create({ owner: u._id, projects: 0 });
    await releaseProjectSlot(String(u._id));
    const counter = await UsageCounter.findOne({ owner: u._id });
    expect(counter?.projects).toBe(0);
  });

  it('adjustProjectCounter delta=0 is a no-op', async () => {
    const u = await User.create({
      email: 'zero@t.com',
      password: 'x',
      profile: { firstName: 'Z', lastName: 'E' },
      emailVerified: true,
    });
    await adjustProjectCounter(String(u._id), 0);
    const counter = await UsageCounter.findOne({ owner: u._id });
    expect(counter).toBeNull();
  });

  it('adjustProjectCounter negative delta stops at zero (does not consume below 0)', async () => {
    const u = await User.create({
      email: 'neg@t.com',
      password: 'x',
      profile: { firstName: 'N', lastName: 'E' },
      emailVerified: true,
    });
    await UsageCounter.create({ owner: u._id, projects: 1 });
    await adjustProjectCounter(String(u._id), -5);
    const counter = await UsageCounter.findOne({ owner: u._id });
    expect(counter?.projects).toBe(0);
  });

  it('reconcileProjectCounter clamps negative inputs to 0 and upserts', async () => {
    const u = await User.create({
      email: 'rec@t.com',
      password: 'x',
      profile: { firstName: 'R', lastName: 'E' },
      emailVerified: true,
    });
    await reconcileProjectCounter(String(u._id), -3);
    const c1 = await UsageCounter.findOne({ owner: u._id });
    expect(c1?.projects).toBe(0);

    await reconcileProjectCounter(String(u._id), 7);
    const c2 = await UsageCounter.findOne({ owner: u._id });
    expect(c2?.projects).toBe(7);
  });

  it('reserveProjectSlot at cap throws projectLimitReached with cap details', async () => {
    const u = await User.create({
      email: 'atcap@t.com',
      password: 'x',
      profile: { firstName: 'A', lastName: 'C' },
      emailVerified: true,
    });
    // Seed 1 project + counter=1 (free cap=1) → next reservation must reject.
    await UsageCounter.create({ owner: u._id, projects: 1 });
    await expect(
      reserveProjectSlot(String(u._id), { countActiveProjects: async () => 1 }),
    ).rejects.toMatchObject({
      status: 403,
      details: { reason: 'projectLimitReached', cap: 1 },
    });
  });

  it('reserveProjectSlot bootstrap E11000 is caught as a no-op (concurrent-insert race)', async () => {
    // Simulate the concurrent-bootstrap race: one thread's upsert would insert,
    // the other's would collide on the unique(owner) index. The catch branch
    // treats a dup-key as "doc exists" and falls through to the atomic
    // reservation — never surfaces as a 500.
    const u = await User.create({
      email: 'boot-race@t.com',
      password: 'x',
      profile: { firstName: 'B', lastName: 'R' },
      emailVerified: true,
    });
    await UsageCounter.create({ owner: u._id, projects: 0 });
    const spy = vi
      .spyOn(UsageCounter, 'updateOne')
      .mockImplementationOnce(() => {
        const err = new Error('E11000 duplicate key');
        (err as { code?: number }).code = 11000;
        throw err;
      });
    try {
      await reserveProjectSlot(String(u._id), {
        countActiveProjects: async () => 0,
      });
    } finally {
      spy.mockRestore();
    }
    const counter = await UsageCounter.findOne({ owner: u._id });
    expect(counter?.projects).toBe(1);
  });

  it('reserveProjectSlot re-throws a non-dup bootstrap error', async () => {
    const u = await User.create({
      email: 'boot-other@t.com',
      password: 'x',
      profile: { firstName: 'B', lastName: 'O' },
      emailVerified: true,
    });
    const spy = vi
      .spyOn(UsageCounter, 'updateOne')
      .mockImplementationOnce(() => {
        throw new Error('mongo unavailable');
      });
    try {
      await expect(
        reserveProjectSlot(String(u._id), {
          countActiveProjects: async () => 0,
        }),
      ).rejects.toThrow('mongo unavailable');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('agent reservation ledger — atomic per-plan agent-cap enforcement', () => {
  beforeAll(() => startMemoryMongo());
  afterAll(() => stopMemoryMongo());
  beforeEach(() => clearCollections());

  async function seedUserRow(email: string): Promise<string> {
    const u = await User.create({
      email,
      password: 'x',
      profile: { firstName: 'A', lastName: 'G' },
      emailVerified: true,
    });
    return String(u._id);
  }

  it('reserveAgentSlot upserts the counter to 1 on the first reservation (free cap=1)', async () => {
    const id = await seedUserRow('agent-first@t.com');
    await reserveAgentSlot(id);
    const counter = await UsageCounter.findOne({ owner: id });
    expect(counter?.agents).toBe(1);
  });

  it('reserveAgentSlot is a no-op on the infinite tier (Business ceiling)', async () => {
    const prev = env.PAYMENT_PROVIDER;
    (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'none';
    try {
      const id = await seedUserRow('agent-inf@t.com');
      await reserveAgentSlot(id);
      const counter = await UsageCounter.findOne({ owner: id });
      expect(counter).toBeNull();
    } finally {
      (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = prev;
    }
  });

  it('reserveAgentSlot at cap throws agentLimitReached with {used, cap}', async () => {
    const id = await seedUserRow('agent-atcap@t.com');
    // Free cap = 1; seed the counter at 1 so the next reservation rejects.
    await UsageCounter.create({ owner: id, agents: 1 });
    await expect(reserveAgentSlot(id)).rejects.toMatchObject({
      status: 403,
      details: { reason: 'agentLimitReached', used: 1, cap: 1 },
    });
  });

  it('reserveAgentSlot bootstrap E11000 is caught and retried (concurrent-insert race)', async () => {
    const id = await seedUserRow('agent-boot-race@t.com');
    await UsageCounter.create({ owner: id, agents: 0 });
    const spy = vi.spyOn(UsageCounter, 'updateOne').mockImplementationOnce(() => {
      const err = new Error('E11000 duplicate key');
      (err as { code?: number }).code = 11000;
      throw err;
    });
    try {
      await reserveAgentSlot(id);
    } finally {
      spy.mockRestore();
    }
    const counter = await UsageCounter.findOne({ owner: id });
    expect(counter?.agents).toBe(1);
  });

  it('reserveAgentSlot E11000 retry that still misses the cap rejects', async () => {
    const id = await seedUserRow('agent-boot-full@t.com');
    // Row already at cap; the E11000 retry finds no room and rejects.
    await UsageCounter.create({ owner: id, agents: 1 });
    const spy = vi.spyOn(UsageCounter, 'updateOne').mockImplementationOnce(() => {
      const err = new Error('E11000 duplicate key');
      (err as { code?: number }).code = 11000;
      throw err;
    });
    try {
      await expect(reserveAgentSlot(id)).rejects.toMatchObject({
        status: 403,
        details: { reason: 'agentLimitReached', cap: 1 },
      });
    } finally {
      spy.mockRestore();
    }
  });

  it('reserveAgentSlot re-throws a non-dup bootstrap error', async () => {
    const id = await seedUserRow('agent-boot-other@t.com');
    const spy = vi.spyOn(UsageCounter, 'updateOne').mockImplementationOnce(() => {
      throw new Error('mongo unavailable');
    });
    try {
      await expect(reserveAgentSlot(id)).rejects.toThrow('mongo unavailable');
    } finally {
      spy.mockRestore();
    }
  });

  it('releaseAgentSlot clamps at zero (never goes negative)', async () => {
    const id = await seedUserRow('agent-clamp@t.com');
    await UsageCounter.create({ owner: id, agents: 0 });
    await releaseAgentSlot(id);
    const counter = await UsageCounter.findOne({ owner: id });
    expect(counter?.agents).toBe(0);
  });

  it('reconcileAgentCounter clamps negative inputs to 0 and upserts an absolute value', async () => {
    const id = await seedUserRow('agent-rec@t.com');
    await reconcileAgentCounter(id, -3);
    expect((await UsageCounter.findOne({ owner: id }))?.agents).toBe(0);
    await reconcileAgentCounter(id, 4);
    expect((await UsageCounter.findOne({ owner: id }))?.agents).toBe(4);
  });
});
