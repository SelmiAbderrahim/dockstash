import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeCronScheduler } from '../scheduler/scheduler.cron.node.js';
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
  expireGraceIfNeeded,
  GRACE_WINDOW_MS,
  handleRefund,
  selectProjectsToKeep,
} from './lifecycle.service.js';
import {
  reconcileSubscriptions,
  registerReconciliationCron,
  unregisterReconciliationCron,
} from './reconcile.js';
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
    // no sub at all
    expect(await expireGraceIfNeeded(String(u._id))).toBe(0);
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
    expect(await expireGraceIfNeeded(String(u._id))).toBe(0);
    // past_due but still within grace
    active.status = 'past_due';
    active.graceEndsAt = new Date(Date.now() + GRACE_WINDOW_MS);
    await active.save();
    expect(await expireGraceIfNeeded(String(u._id))).toBe(0);
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
    await local('s_period', { currentPeriodEnd: dateP }); // period differ (remote incomplete→active)
    await local('s_nodiff', {}); // identical → no heal
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
      remote('s_canceled', { status: 'canceled' }),
      remote('s_pastdue', { status: 'past_due' }),
      remote('s_ghost', {}), // no local row → skipped
    ];
    const summary = await reconcileSubscriptions(reconcileProvider(remotes));
    expect(summary.polled).toBe(7);
    expect(summary.healed).toBe(5); // all but s_nodiff
    expect(summary.errors).toBe(0);
    expect((await Subscription.findOne({ providerSubscriptionId: 's_status' }))?.status).toBe('revoked');
    expect((await Subscription.findOne({ providerSubscriptionId: 's_canceled' }))?.status).toBe('canceled');
    expect((await Subscription.findOne({ providerSubscriptionId: 's_pastdue' }))?.status).toBe('past_due');
    expect(await Subscription.countDocuments({ providerSubscriptionId: 's_ghost' })).toBe(0);
  });
});

describe('reconcile / cron registration', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });
  afterAll(async () => {
    await stopMemoryMongo();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a job whose callback runs a reconciliation pass', async () => {
    let captured: (() => Promise<void>) | null = null;
    const registerSpy = vi
      .spyOn(NodeCronScheduler.prototype, 'register')
      .mockImplementation((_id, _expr, run) => {
        captured = run;
      });
    const unregisterSpy = vi
      .spyOn(NodeCronScheduler.prototype, 'unregister')
      .mockImplementation(() => undefined);

    registerReconciliationCron();
    expect(registerSpy).toHaveBeenCalledOnce();
    expect(captured).toBeTypeOf('function');
    // Invoke the scheduled callback directly (provider unconfigured → noop).
    await captured!();

    unregisterReconciliationCron();
    expect(unregisterSpy).toHaveBeenCalledOnce();
  });
});
