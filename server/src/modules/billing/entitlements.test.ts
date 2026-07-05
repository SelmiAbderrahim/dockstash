import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { env } from '../../config/env.js';
import { User } from '../users/index.js';
import { Project } from '../backups/backups.model.js';
import { __setPaymentProviderForTests } from './active-provider.js';
import {
  assertProjectCap,
  assertScheduleAllowed,
  assertRestoreDrillAllowed,
  assertMultiVpsAllowed,
  assertPitrAllowed,
  isEmailAlertsAllowed,
  classifyCron,
  clampRetentionDays,
  clampRetentionPolicy,
  KEEP_LAST_MAX,
  resolveEntitlements,
} from './entitlements.service.js';
import { getBillingOverviewForUser, getUsageForUser } from './billing.service.js';
import { PricingTier } from './pricing-tier.model.js';
import { Subscription, findEffectiveSubscription } from './subscription.model.js';
import { seedPricingTiers } from './pricing-tier.seed.js';
import { getPlanForProductId, getProductIdForPlan } from './polar-config.js';
import {
  applyProjectCap,
  beginDunning,
  expireGraceIfNeeded,
  GRACE_WINDOW_MS,
  handleDowngrade,
  handleRefund,
  selectProjectsToKeep,
} from './lifecycle.service.js';
import { Customer } from './customer.model.js';
import { Order } from './order.model.js';
import { PolarProvider } from './providers/polar.js';

const CONFIGURED_PROVIDER = new PolarProvider({
  nowSeconds: () => 1_700_000_000,
  getWebhookSecret: () => 'test-webhook-secret',
});

async function createOwner(email = 'owner@example.com') {
  const user = await User.create({
    email,
    password: 'x'.repeat(60),
    profile: { firstName: 'O', lastName: 'W' },
    emailVerified: true,
  });
  return user;
}

async function createProject(ownerId: string, name = 'proj') {
  return Project.create({
    owner: ownerId,
    name,
    path: '/var/www/x',
    plan: { paths: ['/var/www/x'], databases: [], configs: [] },
    repoPasswordEnc: { ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 },
    lastStatus: 'idle',
    paused: false,
  });
}

async function seedActiveSub(
  userId: string,
  planSlug: 'pro' | 'business',
): Promise<void> {
  const customer = await Customer.create({
    userId,
    provider: 'polar',
    providerCustomerId: `pc_${userId}`,
    email: 'buyer@example.com',
  });
  await Subscription.create({
    userId,
    customerId: customer._id,
    provider: 'polar',
    providerSubscriptionId: `sub_${userId}`,
    productId:
      planSlug === 'pro' ? 'prod_pro' : 'prod_business',
    planSlug,
    status: 'active',
    cancelAtPeriodEnd: false,
  });
}

beforeAll(async () => {
  await startMemoryMongo();
});
afterAll(async () => {
  await stopMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  __setPaymentProviderForTests(CONFIGURED_PROVIDER);
  (env as { POLAR_ACCESS_TOKEN?: string }).POLAR_ACCESS_TOKEN = 'polar_test_pat';
  (env as { POLAR_PRO_PRODUCT_ID?: string }).POLAR_PRO_PRODUCT_ID = 'prod_pro';
  (env as { POLAR_BUSINESS_PRODUCT_ID?: string }).POLAR_BUSINESS_PRODUCT_ID = 'prod_business';
});

describe('polar-config reverse lookup', () => {
  it('round-trips configured product ids', () => {
    // `PLAN_TO_PRODUCT` snapshots env at module load; if the merchant hasn't
    // set POLAR_PRO_PRODUCT_ID, the getter returns null and the lookup is a
    // no-op. Only assert the round trip on non-null configured entries.
    const pro = getProductIdForPlan('pro');
    const biz = getProductIdForPlan('business');
    if (pro) expect(getPlanForProductId(pro)).toBe('pro');
    if (biz) expect(getPlanForProductId(biz)).toBe('business');
  });

  it('unknown / null / undefined product ids default to free', () => {
    expect(getPlanForProductId(undefined)).toBe('free');
    expect(getPlanForProductId(null)).toBe('free');
    expect(getPlanForProductId('prod_unknown_xyz')).toBe('free');
  });
});

describe('entitlements resolution', () => {
  it('OSS self-host (PAYMENT_PROVIDER=none) → business ceiling', async () => {
    const prev = env.PAYMENT_PROVIDER;
    (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'none';
    __setPaymentProviderForTests(null);
    try {
      const user = await createOwner();
      const resolved = await resolveEntitlements(String(user._id));
      expect(resolved.slug).toBe('business');
    } finally {
      (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = prev;
      __setPaymentProviderForTests(null);
    }
  });

  it('paid provider selected but uncredentialled → free (fail safe, not open)', async () => {
    // Regression: PAYMENT_PROVIDER=polar with no access token must NOT hand every
    // user the business ceiling. A no-subscription user resolves to free.
    const prevToken = env.POLAR_ACCESS_TOKEN;
    (env as { POLAR_ACCESS_TOKEN?: string }).POLAR_ACCESS_TOKEN = undefined;
    __setPaymentProviderForTests(null);
    try {
      const user = await createOwner();
      const resolved = await resolveEntitlements(String(user._id));
      expect(resolved.slug).toBe('free');
      expect(resolved.entitlements.projects).toBe(1);
      expect(resolved.entitlements.multiVps).toBe(false);
      expect(resolved.status).toBe('none');
    } finally {
      (env as { POLAR_ACCESS_TOKEN?: string }).POLAR_ACCESS_TOKEN = prevToken;
      __setPaymentProviderForTests(null);
    }
  });

  it('no subscription → free', async () => {
    const user = await createOwner();
    const resolved = await resolveEntitlements(String(user._id));
    expect(resolved.slug).toBe('free');
    expect(resolved.entitlements.projects).toBe(1);
  });

  it('active pro → pro entitlements', async () => {
    const user = await createOwner();
    await seedActiveSub(String(user._id), 'pro');
    const resolved = await resolveEntitlements(String(user._id));
    expect(resolved.slug).toBe('pro');
    expect(resolved.entitlements.projects).toBe(10);
  });

  it('past_due within grace keeps paid entitlements', async () => {
    const user = await createOwner();
    await seedActiveSub(String(user._id), 'pro');
    const future = new Date(Date.now() + GRACE_WINDOW_MS);
    await Subscription.updateOne(
      { userId: user._id },
      { $set: { status: 'past_due', graceEndsAt: future } },
    );
    const resolved = await resolveEntitlements(String(user._id));
    expect(resolved.slug).toBe('pro');
    expect(resolved.status).toBe('past_due');
  });

  it('past_due past grace → free', async () => {
    const user = await createOwner();
    await seedActiveSub(String(user._id), 'pro');
    const past = new Date(Date.now() - 1000);
    await Subscription.updateOne(
      { userId: user._id },
      { $set: { status: 'past_due', graceEndsAt: past } },
    );
    const resolved = await resolveEntitlements(String(user._id));
    expect(resolved.slug).toBe('free');
  });
});

describe('enforcement guards', () => {
  it('assertProjectCap blocks free user over 1 project', async () => {
    const user = await createOwner();
    await createProject(String(user._id), 'a');
    await createProject(String(user._id), 'b');
    await expect(
      assertProjectCap(String(user._id), {
        countActiveProjects: async () =>
          Project.countDocuments({ owner: user._id, paused: { $ne: true } }),
      }),
    ).rejects.toMatchObject({
      status: 403,
      details: { reason: 'projectLimitReached' },
    });
  });

  it('assertProjectCap allows free user under cap', async () => {
    const user = await createOwner();
    await createProject(String(user._id), 'a');
    await expect(
      assertProjectCap(String(user._id), {
        countActiveProjects: async () =>
          Project.countDocuments({ owner: user._id, paused: { $ne: true } }),
      }),
    ).resolves.toMatchObject({ slug: 'free' });
  });

  it('assertScheduleAllowed blocks free user (schedules locked)', async () => {
    const user = await createOwner();
    await expect(
      assertScheduleAllowed(String(user._id), { frequency: 'daily' }),
    ).rejects.toMatchObject({
      status: 403,
      details: { reason: 'schedulesLocked' },
    });
  });

  it('assertScheduleAllowed rejects pro user requesting any-cron', async () => {
    const user = await createOwner();
    await seedActiveSub(String(user._id), 'pro');
    await expect(
      assertScheduleAllowed(String(user._id), { frequency: 'any-cron' }),
    ).rejects.toMatchObject({
      status: 403,
      details: { reason: 'frequencyNotAllowed' },
    });
  });

  it('assertScheduleAllowed allows pro user requesting hourly', async () => {
    const user = await createOwner();
    await seedActiveSub(String(user._id), 'pro');
    await expect(
      assertScheduleAllowed(String(user._id), { frequency: 'hourly' }),
    ).resolves.toMatchObject({ slug: 'pro' });
  });

  it('assertRestoreDrillAllowed blocks free, allows pro', async () => {
    const free = await createOwner('free-drill@example.com');
    await expect(
      assertRestoreDrillAllowed(String(free._id)),
    ).rejects.toMatchObject({
      status: 403,
      details: { reason: 'restoreDrillsLocked' },
    });
    const pro = await createOwner('pro-drill@example.com');
    await seedActiveSub(String(pro._id), 'pro');
    await expect(
      assertRestoreDrillAllowed(String(pro._id)),
    ).resolves.toMatchObject({ slug: 'pro' });
  });

  it('assertMultiVpsAllowed blocks free/pro, allows business', async () => {
    const free = await createOwner('free-vps@example.com');
    await expect(
      assertMultiVpsAllowed(String(free._id)),
    ).rejects.toMatchObject({ status: 403, details: { reason: 'multiVpsLocked' } });
    const pro = await createOwner('pro-vps@example.com');
    await seedActiveSub(String(pro._id), 'pro');
    await expect(
      assertMultiVpsAllowed(String(pro._id)),
    ).rejects.toMatchObject({ status: 403, details: { reason: 'multiVpsLocked' } });
    const biz = await createOwner('biz-vps@example.com');
    await seedActiveSub(String(biz._id), 'business');
    await expect(
      assertMultiVpsAllowed(String(biz._id)),
    ).resolves.toMatchObject({ slug: 'business' });
  });

  it('isEmailAlertsAllowed is false for free, true for pro', async () => {
    const free = await createOwner('free-mail@example.com');
    expect(await isEmailAlertsAllowed(String(free._id))).toBe(false);
    const pro = await createOwner('pro-mail@example.com');
    await seedActiveSub(String(pro._id), 'pro');
    expect(await isEmailAlertsAllowed(String(pro._id))).toBe(true);
  });

  it('classifyCron labels daily/hourly/continuous/any-cron', () => {
    expect(classifyCron('0 3 * * *')).toBe('daily');
    expect(classifyCron('30 * * * *')).toBe('hourly');
    expect(classifyCron('*/5 * * * *')).toBe('continuous');
    expect(classifyCron('* * * * *')).toBe('any-cron');
  });

  it('getUsageForUser returns per-project metering for active projects', async () => {
    const user = await createOwner('meter@example.com');
    const withRun = await createProject(String(user._id), 'has-run');
    await Project.updateOne(
      { _id: withRun._id },
      {
        $set: {
          snapshotCount: 4,
          totalRepoBytes: 4096,
          lastRunAt: new Date('2026-07-01T00:00:00Z'),
          lastStatus: 'success',
        },
      },
    );
    // a second project that has never run (lastRunAt null → mapped to null)
    await createProject(String(user._id), 'never-run');
    const usage = await getUsageForUser(String(user._id));
    expect(usage.metering).toHaveLength(2);
    const ran = usage.metering.find((m) => m.name === 'has-run');
    expect(ran).toMatchObject({
      snapshotCount: 4,
      sizeBytes: 4096,
      lastStatus: 'success',
    });
    expect(ran?.lastRunAt).toBe('2026-07-01T00:00:00.000Z');
    const fresh = usage.metering.find((m) => m.name === 'never-run');
    expect(fresh).toMatchObject({ snapshotCount: 0, sizeBytes: 0 });
    expect(fresh?.lastRunAt).toBeNull();
  });

  it('clampRetentionDays never widens', async () => {
    const user = await createOwner();
    expect(await clampRetentionDays(String(user._id), 90)).toBe(7);
    expect(await clampRetentionDays(String(user._id), 3)).toBe(3);
  });
});

describe('PricingTier seed', () => {
  it('idempotent: seeds three tiers, re-run adds no rows', async () => {
    await seedPricingTiers();
    await seedPricingTiers();
    const rows = await PricingTier.find({}).lean();
    expect(rows).toHaveLength(3);
    const slugs = rows.map((r) => r.slug).sort();
    expect(slugs).toEqual(['business', 'free', 'pro']);
  });

  it('preserves edited pricing across re-runs', async () => {
    await seedPricingTiers();
    await PricingTier.updateOne({ slug: 'pro' }, { $set: { priceMonthly: 1234 } });
    await seedPricingTiers();
    const pro = await PricingTier.findOne({ slug: 'pro' }).lean();
    expect(pro?.priceMonthly).toBe(1234);
  });
});

describe('lifecycle: dunning + grace', () => {
  it('beginDunning sets past_due + graceEndsAt', async () => {
    const user = await createOwner();
    await seedActiveSub(String(user._id), 'pro');
    const now = new Date();
    const changed = await beginDunning(`sub_${String(user._id)}`, now);
    expect(changed).toBe(true);
    const sub = await Subscription.findOne({ userId: user._id }).lean();
    expect(sub?.status).toBe('past_due');
    expect(sub?.graceEndsAt).toBeTruthy();
  });

  it('beginDunning is idempotent on repeat delivery', async () => {
    const user = await createOwner();
    await seedActiveSub(String(user._id), 'pro');
    const now = new Date();
    await beginDunning(`sub_${String(user._id)}`, now);
    const first = await Subscription.findOne({ userId: user._id }).lean();
    const later = new Date(now.getTime() + 5000);
    const changed = await beginDunning(`sub_${String(user._id)}`, later);
    expect(changed).toBe(false);
    const second = await Subscription.findOne({ userId: user._id }).lean();
    expect(second?.graceEndsAt?.getTime()).toBe(first?.graceEndsAt?.getTime());
  });

  it('expireGraceIfNeeded demotes past-grace to free and pauses over-cap projects', async () => {
    const user = await createOwner();
    await seedActiveSub(String(user._id), 'pro');
    await createProject(String(user._id), 'a');
    await createProject(String(user._id), 'b');
    const past = new Date(Date.now() - 1000);
    await Subscription.updateOne(
      { userId: user._id },
      { $set: { status: 'past_due', graceEndsAt: past } },
    );
    const result = await expireGraceIfNeeded(String(user._id));
    expect(result.expired).toBe(true);
    expect(result.paused).toBeGreaterThanOrEqual(1);
    const sub = await Subscription.findOne({ userId: user._id }).lean();
    expect(sub?.status).toBe('canceled');
    expect(sub?.planSlug).toBe('free');
    // Backups are retained (no deletion).
    const projects = await Project.find({ owner: user._id }).lean();
    expect(projects).toHaveLength(2);
  });
});

describe('lifecycle: downgrade over cap (no delete)', () => {
  it('handleDowngrade pauses newer projects, marks selectionRequired', async () => {
    const user = await createOwner();
    await seedActiveSub(String(user._id), 'pro');
    for (let i = 0; i < 3; i++) {
      await createProject(String(user._id), `p${i}`);
    }
    const result = await handleDowngrade(String(user._id), null);
    expect(result.paused).toBe(2);
    expect(result.selectionRequired).toBe(true);
    const sub = await Subscription.findOne({ userId: user._id }).lean();
    expect(sub?.selectionRequired).toBe(true);
    // No deletion.
    expect(await Project.countDocuments({ owner: user._id })).toBe(3);
  });

  it('selectProjectsToKeep pauses non-selected, keeps selected', async () => {
    const user = await createOwner();
    await seedActiveSub(String(user._id), 'pro');
    const p1 = await createProject(String(user._id), 'p1');
    const p2 = await createProject(String(user._id), 'p2');
    const p3 = await createProject(String(user._id), 'p3');
    await handleDowngrade(String(user._id), null);
    // After downgrade, sub.planSlug is still 'pro' (only the caps applied);
    // switch it to free to simulate the tier we downgraded to.
    await Subscription.updateOne(
      { userId: user._id },
      { $set: { planSlug: 'free' } },
    );
    const result = await selectProjectsToKeep(String(user._id), [String(p2._id)]);
    expect(result.active).toBe(1);
    const surviving = await Project.findById(p2._id).lean();
    expect(surviving?.paused).toBe(false);
    expect((await Project.findById(p1._id).lean())?.paused).toBe(true);
    expect((await Project.findById(p3._id).lean())?.paused).toBe(true);
    const sub = await Subscription.findOne({ userId: user._id }).lean();
    expect(sub?.selectionRequired).toBe(false);
  });

  it('selectProjectsToKeep rejects selection larger than cap', async () => {
    const user = await createOwner();
    await seedActiveSub(String(user._id), 'pro');
    await Subscription.updateOne(
      { userId: user._id },
      { $set: { planSlug: 'free' } },
    );
    const p1 = await createProject(String(user._id), 'p1');
    const p2 = await createProject(String(user._id), 'p2');
    await expect(
      selectProjectsToKeep(String(user._id), [String(p1._id), String(p2._id)]),
    ).rejects.toMatchObject({
      status: 400,
      details: { reason: 'selectionInvalid' },
    });
  });

  it('selectProjectsToKeep rejects foreign project ids', async () => {
    const user = await createOwner();
    const other = await createOwner('other@example.com');
    await seedActiveSub(String(user._id), 'pro');
    await Subscription.updateOne(
      { userId: user._id },
      { $set: { planSlug: 'free' } },
    );
    const foreign = await createProject(String(other._id), 'foreign');
    await expect(
      selectProjectsToKeep(String(user._id), [String(foreign._id)]),
    ).rejects.toMatchObject({
      status: 403,
      details: { reason: 'notOwner' },
    });
  });

  it('applyProjectCap on unlimited cap → no-op', async () => {
    const user = await createOwner();
    for (let i = 0; i < 3; i++) {
      await createProject(String(user._id), `p${i}`);
    }
    const paused = await applyProjectCap(String(user._id), 'business');
    expect(paused).toBe(0);
  });
});

describe('lifecycle: refund', () => {
  it('handleRefund revokes subscription + pauses projects', async () => {
    const user = await createOwner();
    await seedActiveSub(String(user._id), 'pro');
    const sub = await Subscription.findOne({ userId: user._id });
    for (let i = 0; i < 3; i++) {
      await createProject(String(user._id), `p${i}`);
    }
    const order = await Order.create({
      provider: 'polar',
      providerOrderId: 'ord_x',
      userId: user._id,
      subscriptionId: sub!._id,
      amount: 999,
      currency: 'usd',
      status: 'paid',
    });
    const ok = await handleRefund(String(order.providerOrderId));
    expect(ok).toBe(true);
    const after = await Subscription.findOne({ userId: user._id }).lean();
    expect(after?.status).toBe('revoked');
    expect(after?.planSlug).toBe('free');
    // Projects retained, over-cap paused.
    const total = await Project.countDocuments({ owner: user._id });
    expect(total).toBe(3);
    const paused = await Project.countDocuments({ owner: user._id, paused: true });
    expect(paused).toBe(2);
  });

});

describe('effective subscription selection (status priority)', () => {
  it('an older active row beats a newer canceled row', async () => {
    const user = await createOwner('prio@example.com');
    const customer = await Customer.create({
      userId: user._id,
      provider: 'polar',
      providerCustomerId: 'pc_prio',
      email: 'prio@example.com',
    });
    await Subscription.create({
      userId: user._id,
      customerId: customer._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_old_active',
      productId: 'prod_pro',
      planSlug: 'pro',
      status: 'active',
      cancelAtPeriodEnd: false,
    });
    // Newer canceled row (e.g. an old plan the user canceled after
    // re-subscribing) must NOT shadow the active one.
    await Subscription.create({
      userId: user._id,
      customerId: customer._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_new_canceled',
      productId: 'prod_business',
      planSlug: 'business',
      status: 'canceled',
      cancelAtPeriodEnd: false,
    });
    const effective = await findEffectiveSubscription(String(user._id), 'polar');
    expect(effective?.providerSubscriptionId).toBe('sub_old_active');
    const resolved = await resolveEntitlements(String(user._id));
    expect(resolved.slug).toBe('pro');
    expect(resolved.status).toBe('active');
  });

  it('ties on priority resolve to the newest row; incomplete never entitles', async () => {
    const user = await createOwner('prio2@example.com');
    const customer = await Customer.create({
      userId: user._id,
      provider: 'polar',
      providerCustomerId: 'pc_prio2',
      email: 'prio2@example.com',
    });
    await Subscription.create({
      userId: user._id,
      customerId: customer._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_c1',
      productId: 'prod_pro',
      planSlug: 'pro',
      status: 'canceled',
      cancelAtPeriodEnd: false,
      createdAt: new Date('2030-01-01T00:00:00Z'),
    });
    await Subscription.create({
      userId: user._id,
      customerId: customer._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_c2',
      productId: 'prod_pro',
      planSlug: 'pro',
      status: 'canceled',
      cancelAtPeriodEnd: false,
      createdAt: new Date('2031-01-01T00:00:00Z'),
    });
    const effective = await findEffectiveSubscription(String(user._id), 'polar');
    expect(effective?.providerSubscriptionId).toBe('sub_c2');

    // An incomplete row (checkout started, unpaid) resolves to free.
    await Subscription.create({
      userId: user._id,
      customerId: customer._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_inc',
      productId: 'prod_pro',
      planSlug: 'pro',
      status: 'incomplete',
      cancelAtPeriodEnd: false,
    });
    const resolved = await resolveEntitlements(String(user._id));
    expect(resolved.status).toBe('incomplete');
    expect(resolved.slug).toBe('free');
    const overview = await getBillingOverviewForUser(String(user._id));
    expect(overview.status).toBe('incomplete');
    expect(overview.slug).toBe('free');
  });
});

describe('clampRetentionPolicy', () => {
  it('narrows a wide policy to the free-tier ceiling (7 days)', async () => {
    const user = await createOwner('clamp-free@example.com');
    // No subscription → free tier (7 days retention).
    const clamped = await clampRetentionPolicy(String(user._id), {
      keepDaily: 30,
      keepWeekly: 10,
      keepMonthly: 12,
    });
    expect(clamped).toEqual({ keepDaily: 7, keepWeekly: 1, keepMonthly: 1 });
  });

  it('leaves a policy within the business ceiling untouched', async () => {
    const user = await createOwner('clamp-biz@example.com');
    await seedActiveSub(String(user._id), 'business');
    const clamped = await clampRetentionPolicy(String(user._id), {
      keepDaily: 5,
      keepWeekly: 3,
      keepMonthly: 2,
    });
    expect(clamped).toEqual({ keepDaily: 5, keepWeekly: 3, keepMonthly: 2 });
  });

  it('clamps continuous keeps: keepHourly to tier-days*24, keepLast to KEEP_LAST_MAX', async () => {
    const user = await createOwner('clamp-cont@example.com');
    // Free tier: 7 days → keepHourly ceiling 168.
    const clamped = await clampRetentionPolicy(String(user._id), {
      keepDaily: 3,
      keepWeekly: 1,
      keepMonthly: 1,
      keepHourly: 500,
      keepLast: 10_000,
    });
    expect(clamped).toEqual({
      keepDaily: 3,
      keepWeekly: 1,
      keepMonthly: 1,
      keepHourly: 168,
      keepLast: KEEP_LAST_MAX,
    });
  });

  it('passes small continuous keeps through and omits absent ones', async () => {
    const user = await createOwner('clamp-cont2@example.com');
    await seedActiveSub(String(user._id), 'pro');
    const withKeeps = await clampRetentionPolicy(String(user._id), {
      keepDaily: 7,
      keepWeekly: 4,
      keepMonthly: 6,
      keepHourly: 24,
      keepLast: 12,
    });
    expect(withKeeps.keepHourly).toBe(24);
    expect(withKeeps.keepLast).toBe(12);
    const withoutKeeps = await clampRetentionPolicy(String(user._id), {
      keepDaily: 7,
      keepWeekly: 4,
      keepMonthly: 6,
    });
    expect(withoutKeeps.keepHourly).toBeUndefined();
    expect(withoutKeeps.keepLast).toBeUndefined();
  });
});

describe('assertPitrAllowed', () => {
  it('blocks free, allows pro', async () => {
    const free = await createOwner('free-pitr@example.com');
    await expect(assertPitrAllowed(String(free._id))).rejects.toMatchObject({
      status: 403,
      details: { reason: 'pitrLocked' },
    });
    const pro = await createOwner('pro-pitr@example.com');
    await seedActiveSub(String(pro._id), 'pro');
    await expect(assertPitrAllowed(String(pro._id))).resolves.toMatchObject({
      slug: 'pro',
    });
  });
});
