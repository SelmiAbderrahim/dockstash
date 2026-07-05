import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { env } from '../../config/env.js';
import { User } from '../users/index.js';
import { createProject } from '../backups/backups.service.js';
import { __setPaymentProviderForTests } from '../billing/active-provider.js';
import { PolarProvider } from '../billing/providers/polar.js';
import { Customer } from '../billing/customer.model.js';
import { Subscription } from '../billing/subscription.model.js';
import { Schedule } from './scheduler.model.js';
import { CONTINUOUS_PRESET, createScheduleSchema } from './scheduler.schema.js';
import { createSchedule, enqueueNow, updateSchedule } from './scheduler.service.js';
import { serializeSchedule } from './scheduler.serialize.js';
import { billingEntitlements } from './scheduler.entitlements.js';
import type { Job, JobData, SchedulerQueue } from './scheduler.boundaries.js';

// Suite default: OSS self-host mode → business ceiling, so schedule creation
// is unrestricted. Tier-specific denial tests flip the provider on locally.
const __prevPaymentProvider = env.PAYMENT_PROVIDER;
beforeAll(async () => {
  (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'none';
  await startMemoryMongo();
});
afterAll(async () => {
  (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = __prevPaymentProvider;
  await stopMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});

async function seedUser(email: string): Promise<string> {
  const u = await User.create({
    email,
    password: 'irrelevant',
    profile: { firstName: 'C', lastName: 'B' },
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

function makeQueue(): SchedulerQueue & { added: JobData[] } {
  const added: JobData[] = [];
  return {
    added,
    async add(data: JobData): Promise<Job> {
      added.push(data);
      return { id: `job-${added.length}`, data, attempts: 0 };
    },
    async activeCountForProject() {
      return 0;
    },
    async waitIdle() {},
    async close() {},
  };
}

describe('continuous preset: schema', () => {
  it('rejects a create body with neither cron nor preset', () => {
    const parsed = createScheduleSchema.safeParse({ projectId: 'p1', kind: 'backup' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(['cron']);
    }
  });

  it('accepts preset-only and cron-only bodies', () => {
    expect(
      createScheduleSchema.safeParse({
        projectId: 'p1',
        kind: 'backup',
        preset: 'continuous',
      }).success,
    ).toBe(true);
    expect(
      createScheduleSchema.safeParse({
        projectId: 'p1',
        kind: 'backup',
        cron: '0 3 * * *',
      }).success,
    ).toBe(true);
  });

  it('defaults the new retention keeps to 0 (flag omitted downstream)', () => {
    const parsed = createScheduleSchema.parse({
      projectId: 'p1',
      kind: 'backup',
      cron: '0 3 * * *',
      retention: { keepDaily: 1, keepWeekly: 1, keepMonthly: 1 },
    });
    expect(parsed.retention).toMatchObject({ keepHourly: 0, keepLast: 0 });
  });
});

describe('continuous preset: service expansion', () => {
  it('expands preset to the 5-minute cron + continuous keeps', async () => {
    const owner = await seedUser('preset@t.com');
    const projectId = await seedProject(owner);
    const schedule = await createSchedule(owner, {
      projectId,
      kind: 'backup',
      preset: 'continuous',
    });
    expect(schedule.cron).toBe(CONTINUOUS_PRESET.cron);
    expect(schedule.retention.keepHourly).toBe(24);
    expect(schedule.retention.keepLast).toBe(12);
    expect(schedule.retention.keepDaily).toBe(7);
  });

  it('lets explicit cron and retention win over the preset values', async () => {
    const owner = await seedUser('preset-override@t.com');
    const projectId = await seedProject(owner);
    const schedule = await createSchedule(owner, {
      projectId,
      kind: 'backup',
      preset: 'continuous',
      cron: '*/15 * * * *',
      retention: { keepDaily: 3, keepWeekly: 2, keepMonthly: 1, keepHourly: 6, keepLast: 4 },
    });
    expect(schedule.cron).toBe('*/15 * * * *');
    expect(schedule.retention.keepHourly).toBe(6);
    expect(schedule.retention.keepLast).toBe(4);
  });

  it('keeps the legacy empty-retention default when neither preset nor retention given', async () => {
    const owner = await seedUser('preset-none@t.com');
    const projectId = await seedProject(owner);
    const schedule = await createSchedule(owner, {
      projectId,
      kind: 'backup',
      cron: '0 3 * * *',
    });
    // Mongoose subdoc defaults: 7/4/6 with continuous keeps at 0.
    expect(schedule.retention.keepDaily).toBe(7);
    expect(schedule.retention.keepHourly).toBe(0);
    expect(schedule.retention.keepLast).toBe(0);
  });

  it('updateSchedule merges continuous keeps field-by-field', async () => {
    const owner = await seedUser('preset-update@t.com');
    const projectId = await seedProject(owner);
    const schedule = await createSchedule(owner, {
      projectId,
      kind: 'backup',
      preset: 'continuous',
    });
    const updated = await updateSchedule(schedule._id.toString(), owner, {
      retention: { keepLast: 24 },
    });
    expect(updated.retention.keepLast).toBe(24);
    expect(updated.retention.keepHourly).toBe(24); // untouched preset value
  });

  it('enqueueNow from a continuous schedule carries the keeps into job data', async () => {
    const owner = await seedUser('preset-enqueue@t.com');
    const projectId = await seedProject(owner);
    const schedule = await createSchedule(owner, {
      projectId,
      kind: 'backup',
      preset: 'continuous',
    });
    const queue = makeQueue();
    await enqueueNow(
      owner,
      { scheduleId: schedule._id.toString() },
      { queue, entitlements: { async canEnqueue() { return true; } } },
    );
    expect(queue.added[0]?.retention).toMatchObject({ keepHourly: 24, keepLast: 12 });
  });
});

describe('serializeSchedule: legacy rows', () => {
  it('surfaces 0 for continuous keeps on rows predating the fields', async () => {
    const owner = await seedUser('legacy@t.com');
    const projectId = await seedProject(owner);
    // Raw insert bypasses Mongoose defaults — the shape of a pre-continuous row.
    const raw = await Schedule.collection.insertOne({
      project: (await Schedule.db.collection('projects').findOne({}))?._id,
      owner: (await User.findOne({ email: 'legacy@t.com' }))?._id,
      kind: 'backup',
      cron: '0 3 * * *',
      retention: { keepDaily: 7, keepWeekly: 4, keepMonthly: 6 },
      enabled: true,
      lastEnqueuedAt: null,
      lastRunStatus: 'idle',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    void projectId;
    const doc = await Schedule.findById(raw.insertedId);
    expect(doc).not.toBeNull();
    const serialized = serializeSchedule(doc!);
    expect(serialized.retention.keepHourly).toBe(0);
    expect(serialized.retention.keepLast).toBe(0);
  });
});

describe('billingEntitlements checker', () => {
  const provider = new PolarProvider({
    nowSeconds: () => 1_700_000_000,
    getWebhookSecret: () => 'test-webhook-secret',
  });

  it('OSS self-host (PAYMENT_PROVIDER=none) allows every kind', async () => {
    const owner = await seedUser('oss@t.com');
    expect(await billingEntitlements.canEnqueue(owner, 'drill')).toBe(true);
    expect(await billingEntitlements.canEnqueue(owner, 'backup')).toBe(true);
  });

  it('free tier: drill denied, baseline kinds allowed', async () => {
    const prev = env.PAYMENT_PROVIDER;
    (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'polar';
    __setPaymentProviderForTests(provider);
    try {
      const owner = await seedUser('free-check@t.com');
      expect(await billingEntitlements.canEnqueue(owner, 'drill')).toBe(false);
      expect(await billingEntitlements.canEnqueue(owner, 'backup')).toBe(true);
      expect(await billingEntitlements.canEnqueue(owner, 'restore')).toBe(true);
    } finally {
      (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = prev;
      __setPaymentProviderForTests(null);
    }
  });

  it('pro tier: drill allowed', async () => {
    const prev = env.PAYMENT_PROVIDER;
    (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'polar';
    __setPaymentProviderForTests(provider);
    try {
      const owner = await seedUser('pro-check@t.com');
      const customer = await Customer.create({
        userId: owner,
        provider: 'polar',
        providerCustomerId: `pc_${owner}`,
        email: 'pro-check@t.com',
      });
      await Subscription.create({
        userId: owner,
        customerId: customer._id,
        provider: 'polar',
        providerSubscriptionId: `sub_${owner}`,
        productId: 'prod_pro',
        planSlug: 'pro',
        status: 'active',
        cancelAtPeriodEnd: false,
      });
      expect(await billingEntitlements.canEnqueue(owner, 'drill')).toBe(true);
    } finally {
      (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = prev;
      __setPaymentProviderForTests(null);
    }
  });
});
