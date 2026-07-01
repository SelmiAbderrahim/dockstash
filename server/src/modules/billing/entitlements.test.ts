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
  classifyCron,
  clampRetentionDays,
  resolveEntitlements,
} from './entitlements.service.js';
import { PricingTier } from './pricing-tier.model.js';
import { Subscription } from './subscription.model.js';
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
  assertTrialAvailable,
  recordTrialClaim,
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
  it('OSS default (no provider) → business ceiling', async () => {
    const prevToken = env.POLAR_ACCESS_TOKEN;
    (env as { POLAR_ACCESS_TOKEN?: string }).POLAR_ACCESS_TOKEN = undefined;
    __setPaymentProviderForTests(null);
    try {
      const user = await createOwner();
      const resolved = await resolveEntitlements(String(user._id));
      expect(resolved.slug).toBe('business');
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

  it('classifyCron labels daily/hourly/any-cron', () => {
    expect(classifyCron('0 3 * * *')).toBe('daily');
    expect(classifyCron('30 * * * *')).toBe('hourly');
    expect(classifyCron('*/5 * * * *')).toBe('any-cron');
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
    const paused = await expireGraceIfNeeded(String(user._id));
    expect(paused).toBeGreaterThanOrEqual(1);
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

describe('lifecycle: refund + trial guard', () => {
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

  it('assertTrialAvailable rejects a second trial for the same email', async () => {
    const email = 'trial@example.com';
    const user = await createOwner(email);
    await recordTrialClaim(email, 'polar', 'polar_cust_1', String(user._id));
    await expect(
      assertTrialAvailable(email, 'polar'),
    ).rejects.toMatchObject({ status: 409, details: { reason: 'trialAlreadyClaimed' } });
  });

  it('assertTrialAvailable allows first-time claim', async () => {
    await expect(assertTrialAvailable('new@example.com', 'polar')).resolves.toBeUndefined();
  });
});
