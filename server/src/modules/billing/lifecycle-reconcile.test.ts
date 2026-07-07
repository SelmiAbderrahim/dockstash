import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { User } from '../users/index.js';
import { Project } from '../backups/backups.model.js';
import { Customer } from './customer.model.js';
import { Subscription } from './subscription.model.js';
import { Order } from './order.model.js';
import { __setPaymentProviderForTests } from './active-provider.js';
import {
  applyProjectCap,
  beginDunning,
  expireAllOverdueGraces,
  expireGraceIfNeeded,
  GRACE_WINDOW_MS,
  handleRefund,
  handleUpgrade,
  selectProjectsToKeep,
} from './lifecycle.service.js';
import { reconcileSubscriptions } from './reconcile.js';
import type { IPaymentProvider, NormalizedSubscription } from './payment-provider.js';

async function owner(email = 'own@example.com') {
  return User.create({
    email,
    password: 'x'.repeat(60),
    profile: { firstName: 'O', lastName: 'W' },
    emailVerified: true,
  });
}

async function project(ownerId: string, name: string, paused = false) {
  return Project.create({
    owner: ownerId,
    name,
    path: `/var/www/${name}`,
    plan: { paths: [`/var/www/${name}`], databases: [], configs: [] },
    repoPasswordEnc: { ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 },
    lastStatus: 'idle',
    paused,
  });
}

describe('lifecycle / guard branches', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });
  afterAll(async () => {
    await stopMemoryMongo();
  });
  beforeEach(async () => {
    await clearCollections();
  });

  async function customerFor(userId: string, tag: string) {
    return Customer.create({
      userId,
      provider: 'polar',
      providerCustomerId: `pc_${tag}`,
      email: `${tag}@example.com`,
    });
  }

  it('beginDunning is a no-op when the subscription is already in grace', async () => {
    const u = await owner('dun@example.com');
    const c = await customerFor(String(u._id), 'dun');
    const future = new Date(Date.now() + GRACE_WINDOW_MS);
    await Subscription.create({
      userId: u._id,
      customerId: c._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_dun',
      productId: 'p',
      planSlug: 'pro',
      status: 'past_due',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      graceEndsAt: future,
    });
    expect(await beginDunning('sub_dun')).toBe(false);
    // missing subscription → false
    expect(await beginDunning('nope')).toBe(false);
  });

  it('expireGraceIfNeeded short-circuits for missing / non-past_due / still-in-grace subs', async () => {
    const u = await owner('exp@example.com');
    const c = await customerFor(String(u._id), 'exp');
    const noop = { expired: false, paused: 0 };
    // no sub at all
    expect(await expireGraceIfNeeded(String(u._id))).toEqual(noop);
    // active sub
    const active = await Subscription.create({
      userId: u._id,
      customerId: c._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_active',
      productId: 'p',
      planSlug: 'pro',
      status: 'active',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
    });
    expect(await expireGraceIfNeeded(String(u._id))).toEqual(noop);
    // past_due but still within grace
    active.status = 'past_due';
    active.graceEndsAt = new Date(Date.now() + GRACE_WINDOW_MS);
    await active.save();
    expect(await expireGraceIfNeeded(String(u._id))).toEqual(noop);
  });

  it('expireAllOverdueGraces sweeps overdue rows and survives a failing row', async () => {
    const u1 = await owner('sweep1@example.com');
    const u2 = await owner('sweep2@example.com');
    const c1 = await customerFor(String(u1._id), 'sw1');
    const c2 = await customerFor(String(u2._id), 'sw2');
    const past = new Date(Date.now() - 1000);
    await Subscription.create({
      userId: u1._id,
      customerId: c1._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_sw1',
      productId: 'p',
      planSlug: 'pro',
      status: 'past_due',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      graceEndsAt: past,
    });
    await Subscription.create({
      userId: u2._id,
      customerId: c2._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_sw2',
      productId: 'p',
      planSlug: 'pro',
      status: 'past_due',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      graceEndsAt: past,
    });
    // over-cap projects for u1: free cap = 1 → one project gets paused
    await project(String(u1._id), 'sw1a');
    await project(String(u1._id), 'sw1b');
    const summary = await expireAllOverdueGraces();
    expect(summary).toEqual({ scanned: 2, downgraded: 2, paused: 1 });
    expect(
      (await Subscription.findOne({ providerSubscriptionId: 'sub_sw1' }))?.status,
    ).toBe('canceled');

    // failing row: make the sweep hit an error for one user, keep going
    await clearCollections();
    const u3 = await owner('sweep3@example.com');
    const c3 = await customerFor(String(u3._id), 'sw3');
    await Subscription.create({
      userId: u3._id,
      customerId: c3._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_sw3',
      productId: 'p',
      planSlug: 'pro',
      status: 'past_due',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      graceEndsAt: past,
    });
    const spy = vi
      .spyOn(Subscription, 'find')
      .mockReturnValueOnce({
        select: () => ({
          lean: async () => [{ userId: u3._id }],
        }),
      } as never)
      .mockImplementationOnce(() => {
        throw new Error('db down');
      });
    const failed = await expireAllOverdueGraces();
    expect(failed).toEqual({ scanned: 1, downgraded: 0, paused: 0 });
    spy.mockRestore();
  });

  it('handleUpgrade unpauses everything under the new cap and requires selection when still over', async () => {
    const u = await owner('up@example.com');
    const c = await customerFor(String(u._id), 'up');
    const sub = await Subscription.create({
      userId: u._id,
      customerId: c._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_up',
      productId: 'p',
      planSlug: 'free',
      status: 'active',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      selectionRequired: true,
    });
    await project(String(u._id), 'up-a', true);
    await project(String(u._id), 'up-b', true);
    // Unknown product id → free tier (cap 1) → 2 projects still over cap.
    const still = await handleUpgrade(String(u._id), null);
    expect(still).toEqual({ unpaused: 0, selectionRequired: true });
    expect(
      (await Project.find({ owner: u._id, paused: true })).length,
    ).toBe(2);

    // Business (unlimited) → everything reactivates, selection cleared.
    const prev = env.POLAR_BUSINESS_PRODUCT_ID;
    (env as { POLAR_BUSINESS_PRODUCT_ID?: string }).POLAR_BUSINESS_PRODUCT_ID =
      'prod_biz';
    try {
      const res = await handleUpgrade(String(u._id), 'prod_biz');
      expect(res).toEqual({ unpaused: 2, selectionRequired: false });
      expect(await Project.countDocuments({ owner: u._id, paused: true })).toBe(0);
      expect((await Subscription.findById(sub._id))?.selectionRequired).toBe(false);
      // Idempotent: nothing paused → no-op.
      const again = await handleUpgrade(String(u._id), 'prod_biz');
      expect(again).toEqual({ unpaused: 0, selectionRequired: false });
      // Defensive: a driver result without modifiedCount coerces to 0.
      const spy = vi
        .spyOn(Project, 'updateMany')
        .mockResolvedValueOnce({ acknowledged: true, modifiedCount: undefined } as never);
      const coerced = await handleUpgrade(String(u._id), 'prod_biz');
      expect(coerced).toEqual({ unpaused: 0, selectionRequired: false });
      spy.mockRestore();
    } finally {
      (env as { POLAR_BUSINESS_PRODUCT_ID?: string }).POLAR_BUSINESS_PRODUCT_ID =
        prev;
    }
  });

  it('applyProjectCap returns 0 when no projects exceed the cap', async () => {
    const u = await owner('cap@example.com');
    await project(String(u._id), 'only'); // free cap = 1, one active project
    expect(await applyProjectCap(String(u._id), 'free')).toBe(0);
    // business (infinite cap) short-circuits immediately
    expect(await applyProjectCap(String(u._id), 'business')).toBe(0);
  });

  it('handleRefund skips re-marking an already-refunded order and tolerates a missing sub', async () => {
    const u = await owner('ref@example.com');
    // already-refunded order pointing at a subscription id that does not exist
    await Order.create({
      userId: u._id,
      provider: 'polar',
      providerOrderId: 'ord_ref',
      subscriptionId: '64b7f000000000000000beef',
      amount: 1,
      currency: 'usd',
      status: 'refunded',
    });
    expect(await handleRefund('ord_ref')).toBe(true);
    // unknown order id → false
    expect(await handleRefund('missing')).toBe(false);
  });

  it('selectProjectsToKeep defaults to free when no subscription exists', async () => {
    const u = await owner('sel@example.com');
    const keep = await project(String(u._id), 'keep');
    await project(String(u._id), 'drop');
    const res = await selectProjectsToKeep(String(u._id), [String(keep._id)]);
    expect(res.active).toBe(1);
    expect(res.paused).toBe(1);
  });

  it('selectProjectsToKeep on business uses the unbounded cap and rejects an empty selection with null cap', async () => {
    const u = await owner('selbiz@example.com');
    const c = await customerFor(String(u._id), 'selbiz');
    await Subscription.create({
      userId: u._id,
      customerId: c._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_biz',
      productId: 'p',
      planSlug: 'business',
      status: 'active',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
    });
    const a = await project(String(u._id), 'a');
    const b = await project(String(u._id), 'b');
    const res = await selectProjectsToKeep(String(u._id), [String(a._id), String(b._id)]);
    expect(res.active).toBe(2);
    // empty selection → invalid, cap reported as null for the unbounded tier
    await expect(selectProjectsToKeep(String(u._id), [])).rejects.toMatchObject({
      details: { reason: 'selectionInvalid', cap: null },
    });
  });

  it('selectProjectsToKeep coerces a missing modifiedCount to 0', async () => {
    const u = await owner('mc@example.com');
    const keep = await project(String(u._id), 'keep-mc');
    await project(String(u._id), 'drop-mc');
    const spy = vi
      .spyOn(Project, 'updateMany')
      .mockResolvedValue({ acknowledged: true, modifiedCount: undefined } as never);
    const res = await selectProjectsToKeep(String(u._id), [String(keep._id)]);
    expect(res.paused).toBe(0);
    spy.mockRestore();
  });
});

function reconcileProvider(remotes: NormalizedSubscription[]): IPaymentProvider {
  return {
    name: 'polar',
    isConfigured: () => true,
    createCheckout: async () => ({ url: '', providerCheckoutId: '' }),
    openPortal: async () => ({ url: '' }),
    changePlan: async () => ({} as never),
    verifyWebhook: () => undefined,
    parseEvent: () => ({ eventId: '', type: '', timestamp: '0', payload: { kind: 'unknown', rawType: '' } }),
    listActiveSubscriptions: async () => remotes,
    getSubscription: async () => null,
  };
}

describe('reconcile / status mapping + diff branches', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });
  afterAll(async () => {
    await stopMemoryMongo();
  });
  beforeEach(async () => {
    await clearCollections();
    __setPaymentProviderForTests(null);
  });
  afterEach(() => {
    __setPaymentProviderForTests(null);
  });

  it('uses the active provider when no override is passed (unconfigured → noop)', async () => {
    const prevToken = (process.env as Record<string, string | undefined>).POLAR_ACCESS_TOKEN;
    // default polar provider is unconfigured in the test env
    const summary = await reconcileSubscriptions();
    expect(summary).toEqual({ polled: 0, healed: 0, errors: 0 });
    (process.env as Record<string, string | undefined>).POLAR_ACCESS_TOKEN = prevToken;
  });

  it('heals every status class and leaves matching rows untouched', async () => {
    const u = await owner('rec@example.com');
    const customer = await Customer.create({
      userId: u._id,
      provider: 'polar',
      providerCustomerId: 'cust_rec',
      email: 'rec@example.com',
    });
    const dateP = new Date('2030-01-01T00:00:00Z');
    const dateP2 = new Date('2031-01-01T00:00:00Z');
    async function local(id: string, over: Partial<Record<string, unknown>>) {
      await Subscription.create({
        userId: u._id,
        customerId: customer._id,
        provider: 'polar',
        providerSubscriptionId: id,
        productId: 'p',
        planSlug: 'pro',
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        ...over,
      });
    }
    await local('s_status', {}); // status differ (→revoked)
    await local('s_cancel', { currentPeriodEnd: dateP }); // cancel differ (remote trialing→active)
    await local('s_period', { currentPeriodEnd: dateP }); // status+period differ (remote incomplete)
    await local('s_nodiff', {}); // identical → no heal
    await local('s_perioddiff', { currentPeriodEnd: dateP }); // only period differs
    await local('s_canceled', {}); // → canceled
    await local('s_pastdue', {}); // → past_due

    function remote(id: string, over: Partial<NormalizedSubscription>): NormalizedSubscription {
      return {
        providerSubscriptionId: id,
        providerCustomerId: 'cust_rec',
        productId: 'p',
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        ...over,
      };
    }
    const remotes: NormalizedSubscription[] = [
      remote('s_status', { status: 'revoked' }),
      remote('s_cancel', { status: 'trialing', cancelAtPeriodEnd: true, currentPeriodEnd: dateP }),
      remote('s_period', { status: 'incomplete', currentPeriodEnd: dateP2 }),
      remote('s_nodiff', {}),
      remote('s_perioddiff', { currentPeriodEnd: dateP2 }),
      remote('s_canceled', { status: 'canceled' }),
      remote('s_pastdue', { status: 'past_due' }),
      remote('s_ghost', {}), // no local row → skipped
    ];
    const summary = await reconcileSubscriptions(reconcileProvider(remotes));
    expect(summary.polled).toBe(8);
    expect(summary.healed).toBe(6); // all but s_nodiff
    expect(summary.errors).toBe(0);
    expect((await Subscription.findOne({ providerSubscriptionId: 's_status' }))?.status).toBe('revoked');
    // `incomplete` persists as `incomplete` — never as entitled `active`.
    expect((await Subscription.findOne({ providerSubscriptionId: 's_period' }))?.status).toBe('incomplete');
    expect((await Subscription.findOne({ providerSubscriptionId: 's_canceled' }))?.status).toBe('canceled');
    expect((await Subscription.findOne({ providerSubscriptionId: 's_pastdue' }))?.status).toBe('past_due');
    expect(await Subscription.countDocuments({ providerSubscriptionId: 's_ghost' })).toBe(0);
  });

  it('heals productId drift and mirrors upgrade/downgrade side effects', async () => {
    const prevPro = env.POLAR_PRO_PRODUCT_ID;
    const prevBiz = env.POLAR_BUSINESS_PRODUCT_ID;
    (env as { POLAR_PRO_PRODUCT_ID?: string }).POLAR_PRO_PRODUCT_ID = 'prod_pro';
    (env as { POLAR_BUSINESS_PRODUCT_ID?: string }).POLAR_BUSINESS_PRODUCT_ID =
      'prod_biz';
    try {
      const u = await owner('drift@example.com');
      const customer = await Customer.create({
        userId: u._id,
        provider: 'polar',
        providerCustomerId: 'cust_drift',
        email: 'drift@example.com',
      });
      async function localSub(id: string, over: Partial<Record<string, unknown>>) {
        return Subscription.create({
          userId: u._id,
          customerId: customer._id,
          provider: 'polar',
          providerSubscriptionId: id,
          productId: 'prod_pro',
          planSlug: 'pro',
          status: 'active',
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
          ...over,
        });
      }
      // Upgrade drift: local pro, remote business → heal + reactivate paused.
      await localSub('s_up', {});
      await project(String(u._id), 'drift-paused', true);
      // Downgrade drift on a second row exercises the downgrade branch.
      await localSub('s_down', { productId: 'prod_biz', planSlug: 'business' });
      // Recovery drift: same product, local past_due, remote active.
      await localSub('s_recover', { status: 'past_due' });

      function remote(id: string, productId: string): NormalizedSubscription {
        return {
          providerSubscriptionId: id,
          providerCustomerId: 'cust_drift',
          productId,
          status: 'active',
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
        };
      }
      const summary = await reconcileSubscriptions(
        reconcileProvider([
          remote('s_up', 'prod_biz'),
          remote('s_down', 'prod_pro'),
          remote('s_recover', 'prod_pro'),
        ]),
      );
      expect(summary.healed).toBe(3);
      const up = await Subscription.findOne({ providerSubscriptionId: 's_up' });
      expect(up?.planSlug).toBe('business');
      expect(up?.productId).toBe('prod_biz');
      const down = await Subscription.findOne({ providerSubscriptionId: 's_down' });
      expect(down?.planSlug).toBe('pro');
      expect(
        (await Subscription.findOne({ providerSubscriptionId: 's_recover' }))?.status,
      ).toBe('active');
      // Upgrade side effect reactivated the paused project.
      expect(await Project.countDocuments({ owner: u._id, paused: true })).toBe(0);
    } finally {
      (env as { POLAR_PRO_PRODUCT_ID?: string }).POLAR_PRO_PRODUCT_ID = prevPro;
      (env as { POLAR_BUSINESS_PRODUCT_ID?: string }).POLAR_BUSINESS_PRODUCT_ID =
        prevBiz;
    }
  });
});
