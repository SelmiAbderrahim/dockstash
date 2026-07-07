import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { env } from '../../config/env.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { translate } from '../../shared/i18n/index.js';
import { User } from '../users/index.js';
import { Project } from '../backups/backups.model.js';
import { Agent } from '../agents/agents.model.js';
import { Schedule } from '../scheduler/scheduler.model.js';
import { setResendTransport } from '../communication/index.js';
import { Customer } from './customer.model.js';
import { Subscription } from './subscription.model.js';
import { __setPaymentProviderForTests } from './active-provider.js';
import { isRetentionGraceActive } from './entitlements.service.js';
import {
  applyProjectCap,
  handleUpgrade,
  selectProjectsToKeep,
  notifyLifecycleEvent,
  setLifecycleNotifier,
  resetLifecycleNotifier,
  expireAllOverdueGraces,
  GRACE_WINDOW_MS,
  type LifecycleEvent,
  type LifecycleNotifier,
  type LifecycleNotifyContext,
} from './lifecycle.service.js';
import { reconcileSubscriptions } from './reconcile.js';
import { dispatchEvent } from './webhook/registry.js';
import { PolarProvider } from './providers/polar.js';
import { StripeProvider } from './providers/stripe.js';
import { PolarApiError } from './providers/polar-rest.js';
import type {
  IPaymentProvider,
  NormalizedSubscription,
  ParsedEvent,
} from './payment-provider.js';

const __prevProvider = env.PAYMENT_PROVIDER;
const __prevPro = env.POLAR_PRO_PRODUCT_ID;
const __prevBiz = env.POLAR_BUSINESS_PRODUCT_ID;
const __prevKey = env.RESEND_API_KEY;
const __prevFrom = env.RESEND_FROM;

beforeAll(async () => {
  await startMemoryMongo();
  (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'polar';
  (env as { POLAR_PRO_PRODUCT_ID?: string }).POLAR_PRO_PRODUCT_ID = 'prod_pro';
  (env as { POLAR_BUSINESS_PRODUCT_ID?: string }).POLAR_BUSINESS_PRODUCT_ID = 'prod_biz';
});
afterAll(async () => {
  await stopMemoryMongo();
  (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = __prevProvider;
  (env as { POLAR_PRO_PRODUCT_ID?: string }).POLAR_PRO_PRODUCT_ID = __prevPro;
  (env as { POLAR_BUSINESS_PRODUCT_ID?: string }).POLAR_BUSINESS_PRODUCT_ID = __prevBiz;
});
beforeEach(async () => {
  await clearCollections();
  __setPaymentProviderForTests(null);
  resetLifecycleNotifier();
});
afterEach(() => {
  __setPaymentProviderForTests(null);
  resetLifecycleNotifier();
  setResendTransport(null);
  (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = __prevKey;
  (env as { RESEND_FROM?: string }).RESEND_FROM = __prevFrom;
});

async function owner(email = 'own@example.com', language?: string) {
  return User.create({
    email,
    password: 'x'.repeat(60),
    profile: { firstName: 'O', lastName: 'W' },
    emailVerified: true,
    ...(language ? { language } : {}),
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

async function agent(ownerId: string, host: string) {
  return Agent.create({
    owner: ownerId,
    name: host,
    host,
    apiKeyHash: { hash: 'h', keyVersion: 1 },
  });
}

async function subFor(
  userId: string,
  over: Partial<Record<string, unknown>> = {},
) {
  const customer = await Customer.create({
    userId,
    provider: 'polar',
    providerCustomerId: `pc_${userId}`,
    email: 'c@example.com',
  });
  return Subscription.create({
    userId,
    customerId: customer._id,
    provider: 'polar',
    providerSubscriptionId: `sub_${userId}`,
    productId: 'prod_pro',
    planSlug: 'pro',
    status: 'active',
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    ...over,
  });
}

// ---------------------------------------------------------------------------
// F1 — isRetentionGraceActive branch coverage.
// ---------------------------------------------------------------------------
describe('F1 isRetentionGraceActive', () => {
  it('is false when billing is disabled (PAYMENT_PROVIDER=none)', async () => {
    (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'none';
    const u = await owner('none@example.com');
    await subFor(String(u._id), {
      retentionGraceUntil: new Date(Date.now() + GRACE_WINDOW_MS),
    });
    expect(await isRetentionGraceActive(String(u._id))).toBe(false);
    (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'polar';
  });

  it('is false with no subscription, false when the stamp is null/elapsed, true within the window', async () => {
    const u = await owner('grace@example.com');
    // no sub row
    expect(await isRetentionGraceActive(String(u._id))).toBe(false);
    // sub with null stamp
    const sub = await subFor(String(u._id));
    expect(await isRetentionGraceActive(String(u._id))).toBe(false);
    // future stamp → active
    sub.retentionGraceUntil = new Date(Date.now() + GRACE_WINDOW_MS);
    await sub.save();
    expect(await isRetentionGraceActive(String(u._id))).toBe(true);
    // elapsed stamp → inactive
    sub.retentionGraceUntil = new Date(Date.now() - 1000);
    await sub.save();
    expect(await isRetentionGraceActive(String(u._id))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// F1/F5/F6 — applyProjectCap side effects.
// ---------------------------------------------------------------------------
describe('F1/F5/F6 applyProjectCap', () => {
  it('stamps a retention grace window when the prior tier retained longer', async () => {
    const u = await owner('stamp@example.com');
    await subFor(String(u._id));
    await project(String(u._id), 'only');
    await applyProjectCap(String(u._id), 'free', { priorSlug: 'pro' });
    expect(await isRetentionGraceActive(String(u._id))).toBe(true);
  });

  it('does NOT stamp when the retention ceiling is unchanged (free→free)', async () => {
    const u = await owner('nostamp@example.com');
    await subFor(String(u._id), { planSlug: 'free' });
    await project(String(u._id), 'only');
    await applyProjectCap(String(u._id), 'free', { priorSlug: 'free' });
    expect(await isRetentionGraceActive(String(u._id))).toBe(false);
  });

  it('disables only currently-enabled schedules on overflow projects (F5)', async () => {
    const u = await owner('sched@example.com');
    await subFor(String(u._id));
    const keep = await project(String(u._id), 'keep');
    const drop = await project(String(u._id), 'drop'); // newest → paused under free cap 1
    const enabled = await Schedule.create({
      owner: u._id,
      project: drop._id,
      kind: 'backup',
      cron: '0 3 * * *',
      enabled: true,
    });
    const userDisabled = await Schedule.create({
      owner: u._id,
      project: drop._id,
      kind: 'prune',
      cron: '0 4 * * *',
      enabled: false,
    });
    // A schedule on the kept project is untouched.
    const keepSched = await Schedule.create({
      owner: u._id,
      project: keep._id,
      kind: 'backup',
      cron: '0 5 * * *',
      enabled: true,
    });
    await applyProjectCap(String(u._id), 'free', { priorSlug: 'pro' });
    expect((await Project.findById(drop._id))?.paused).toBe(true);
    const e = await Schedule.findById(enabled._id);
    expect(e?.enabled).toBe(false);
    expect(e?.pausedByBilling).toBe(true);
    // The user-disabled schedule is NOT tagged (so re-upgrade won't resurrect it).
    const ud = await Schedule.findById(userDisabled._id);
    expect(ud?.enabled).toBe(false);
    expect(ud?.pausedByBilling).toBe(false);
    // Kept project's schedule untouched.
    expect((await Schedule.findById(keepSched._id))?.enabled).toBe(true);
  });

  it('blocks newest-over-cap agents and unblocks the rest (F6), infinite tier clears all blocks', async () => {
    const u = await owner('agents@example.com');
    await subFor(String(u._id));
    const a1 = await agent(String(u._id), 'h1');
    const a2 = await agent(String(u._id), 'h2');
    const a3 = await agent(String(u._id), 'h3');
    // Free cap = 1 agent → a2,a3 (newest) blocked, a1 kept.
    await applyProjectCap(String(u._id), 'free', { priorSlug: 'business' });
    expect((await Agent.findById(a1._id))?.blockedByBilling).toBe(false);
    expect((await Agent.findById(a2._id))?.blockedByBilling).toBe(true);
    expect((await Agent.findById(a3._id))?.blockedByBilling).toBe(true);
    // Infinite tier (business) clears every block.
    await applyProjectCap(String(u._id), 'business', { priorSlug: 'free' });
    for (const a of [a1, a2, a3]) {
      expect((await Agent.findById(a._id))?.blockedByBilling).toBe(false);
    }
  });

  it('is a no-op when nothing exceeds the cap and reconciles the agent counter on the infinite tier', async () => {
    const u = await owner('under@example.com');
    await project(String(u._id), 'only');
    // free (finite) — under cap
    expect(await applyProjectCap(String(u._id), 'free')).toBe(0);
    // business (infinite) — early return + agent reconcile
    expect(await applyProjectCap(String(u._id), 'business')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// F5/F6 — handleUpgrade + selectProjectsToKeep re-enable / unblock.
// ---------------------------------------------------------------------------
describe('F5/F6 re-enable on upgrade + selection', () => {
  it('re-upgrade re-enables billing-paused schedules only, unblocks agents, clears the grace stamp', async () => {
    const u = await owner('reup@example.com');
    await subFor(String(u._id));
    const p = await project(String(u._id), 'p');
    const another = await project(String(u._id), 'q'); // overflow under free
    const billingPaused = await Schedule.create({
      owner: u._id,
      project: another._id,
      kind: 'backup',
      cron: '0 3 * * *',
      enabled: true,
    });
    const userDisabled = await Schedule.create({
      owner: u._id,
      project: another._id,
      kind: 'prune',
      cron: '0 4 * * *',
      enabled: false,
    });
    const ag = await agent(String(u._id), 'h1');
    const ag2 = await agent(String(u._id), 'h2');
    await applyProjectCap(String(u._id), 'free', { priorSlug: 'pro' });
    expect(await isRetentionGraceActive(String(u._id))).toBe(true);
    expect((await Agent.findById(ag2._id))?.blockedByBilling).toBe(true);

    // Upgrade to business (unlimited): everything reactivates.
    const res = await handleUpgrade(String(u._id), 'prod_biz');
    expect(res.selectionRequired).toBe(false);
    expect((await Project.findById(another._id))?.paused).toBe(false);
    expect((await Project.findById(p._id))?.paused).toBe(false);
    // Only the billing-paused schedule is back on.
    expect((await Schedule.findById(billingPaused._id))?.enabled).toBe(true);
    expect((await Schedule.findById(billingPaused._id))?.pausedByBilling).toBe(false);
    expect((await Schedule.findById(userDisabled._id))?.enabled).toBe(false);
    // Agents unblocked, grace cleared.
    expect((await Agent.findById(ag._id))?.blockedByBilling).toBe(false);
    expect((await Agent.findById(ag2._id))?.blockedByBilling).toBe(false);
    expect(await isRetentionGraceActive(String(u._id))).toBe(false);
  });

  it('selectProjectsToKeep re-enables kept schedules, disables the rest, unblocks agents', async () => {
    const u = await owner('sel@example.com');
    await subFor(String(u._id), { planSlug: 'pro', selectionRequired: true });
    const keep = await project(String(u._id), 'keep', true);
    const drop = await project(String(u._id), 'drop', false);
    const keepBillingPaused = await Schedule.create({
      owner: u._id,
      project: keep._id,
      kind: 'backup',
      cron: '0 3 * * *',
      enabled: false,
      pausedByBilling: true,
    });
    const dropEnabled = await Schedule.create({
      owner: u._id,
      project: drop._id,
      kind: 'backup',
      cron: '0 6 * * *',
      enabled: true,
    });
    const ag = await agent(String(u._id), 'h1');
    // Simulate a pre-existing block cleared by selection under pro (cap 5).
    ag.blockedByBilling = true;
    await ag.save();
    const res = await selectProjectsToKeep(String(u._id), [String(keep._id)]);
    expect(res.active).toBe(1);
    expect((await Schedule.findById(keepBillingPaused._id))?.enabled).toBe(true);
    expect((await Schedule.findById(keepBillingPaused._id))?.pausedByBilling).toBe(false);
    expect((await Schedule.findById(dropEnabled._id))?.enabled).toBe(false);
    expect((await Schedule.findById(dropEnabled._id))?.pausedByBilling).toBe(true);
    expect((await Agent.findById(ag._id))?.blockedByBilling).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// F3 — lifecycle notifier.
// ---------------------------------------------------------------------------
describe('F3 lifecycle notifier', () => {
  function captureTransport() {
    (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = 're_test';
    (env as { RESEND_FROM?: string }).RESEND_FROM = 'from@example.com';
    const sent: Array<{ to: string; subject: string; text: string }> = [];
    setResendTransport(async (message) => {
      sent.push({ to: message.to, subject: message.subject, text: message.text });
      return { delivered: true };
    });
    return sent;
  }

  it('default notifier dispatches the right email per event, honouring the user locale', async () => {
    const u = await owner('notify@example.com', 'fr');
    const sent = captureTransport();
    await notifyLifecycleEvent('dunning_started', {
      userId: String(u._id),
      planSlug: 'pro',
      graceEndsAt: new Date('2030-01-01T00:00:00Z'),
    });
    await notifyLifecycleEvent('grace_expired', { userId: String(u._id), planSlug: 'pro' });
    await notifyLifecycleEvent('reactivated', { userId: String(u._id), planSlug: 'pro' });
    expect(sent).toHaveLength(3);
    expect(sent[0]?.subject).toBe(translate('fr', 'email.dunning.subject'));
    expect(sent[0]?.text).toContain('2030-01-01T00:00:00.000Z');
    expect(sent[1]?.subject).toBe(translate('fr', 'email.downgradeNotice.subject'));
    expect(sent[2]?.subject).toBe(translate('fr', 'email.reactivation.subject'));
    // Plan label is capitalized in the body.
    expect(sent[2]?.text).toContain('Pro');
  });

  it('falls back to the default locale when the user has no stored language', async () => {
    const u = await owner('noloc@example.com'); // language unset → isSupportedLocale(undefined) false
    const sent = captureTransport();
    await notifyLifecycleEvent('grace_expired', { userId: String(u._id), planSlug: 'business' });
    expect(sent[0]?.subject).toBe(translate('en', 'email.downgradeNotice.subject'));
  });

  it('dunning email falls back to "now" when graceEndsAt is absent', async () => {
    const u = await owner('nograce@example.com', 'fr');
    const sent = captureTransport();
    // No graceEndsAt in the context → the notifier fills a fallback timestamp.
    await notifyLifecycleEvent('dunning_started', { userId: String(u._id), planSlug: 'pro' });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.subject).toBe(translate('fr', 'email.dunning.subject'));
  });

  it('does nothing when the user has no email (missing/deleted account)', async () => {
    const sent = captureTransport();
    await notifyLifecycleEvent('reactivated', {
      userId: '64b7f000000000000000beef',
      planSlug: 'pro',
    });
    expect(sent).toHaveLength(0);
  });

  it('swallows a throwing notifier (non-fatal)', async () => {
    setLifecycleNotifier({
      notify: async (_event: LifecycleEvent, _ctx: LifecycleNotifyContext) => {
        throw new Error('mailer down');
      },
    });
    await expect(
      notifyLifecycleEvent('grace_expired', { userId: 'x', planSlug: 'pro' }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// F4 — reconcile orphan second pass.
// ---------------------------------------------------------------------------
function orphanProvider(
  getSub: (id: string) => Promise<NormalizedSubscription | null>,
): IPaymentProvider {
  return {
    name: 'polar',
    isConfigured: () => true,
    createCheckout: async () => ({ url: '', providerCheckoutId: '' }),
    openPortal: async () => ({ url: '' }),
    changePlan: async () => ({}) as never,
    verifyWebhook: () => undefined,
    parseEvent: () => ({
      eventId: '',
      type: '',
      timestamp: '0',
      payload: { kind: 'unknown', rawType: '' },
    }),
    listActiveSubscriptions: async () => [],
    getSubscription: getSub,
  };
}

describe('F4 reconcile revisits orphaned local rows', () => {
  it('heals a local active row the listing dropped to canceled/free when the provider 404s', async () => {
    const u = await owner('orphan@example.com');
    await subFor(String(u._id), { status: 'active', planSlug: 'pro' });
    await project(String(u._id), 'a');
    await project(String(u._id), 'b'); // over free cap 1
    const summary = await reconcileSubscriptions(orphanProvider(async () => null));
    expect(summary.healed).toBe(1);
    const row = await Subscription.findOne({ providerSubscriptionId: `sub_${u._id}` });
    expect(row?.status).toBe('canceled');
    expect(row?.planSlug).toBe('free');
    // free-landing pause fired.
    expect(await Project.countDocuments({ owner: u._id, paused: true })).toBe(1);
  });

  it('heals an orphan whose fetched status still differs (e.g. past_due)', async () => {
    const u = await owner('orphan2@example.com');
    await subFor(String(u._id), { status: 'active' });
    const fetched: NormalizedSubscription = {
      providerSubscriptionId: `sub_${u._id}`,
      providerCustomerId: 'pc',
      productId: 'prod_pro',
      status: 'past_due',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
    };
    const summary = await reconcileSubscriptions(orphanProvider(async () => fetched));
    expect(summary.healed).toBe(1);
    expect(
      (await Subscription.findOne({ providerSubscriptionId: `sub_${u._id}` }))?.status,
    ).toBe('past_due');
  });

  it('counts an orphan-fetch failure as an error and continues', async () => {
    const u = await owner('orphan3@example.com');
    await subFor(String(u._id), { status: 'active' });
    const summary = await reconcileSubscriptions(
      orphanProvider(async () => {
        throw new Error('provider 500');
      }),
    );
    expect(summary.errors).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// F4 — provider getSubscription implementations.
// ---------------------------------------------------------------------------
describe('F4 provider.getSubscription', () => {
  function polarWith(request: (path: string) => Promise<unknown>): PolarProvider {
    return new PolarProvider({
      getClient: () => ({ server: 'sandbox', baseUrl: '', request: request as never }),
    });
  }

  it('maps a Polar subscription and returns null on 404', async () => {
    const ok = polarWith(async () => ({
      id: 'sub_x',
      status: 'active',
      customer_id: 'c',
      product_id: 'prod_pro',
      current_period_end: null,
      cancel_at_period_end: false,
    }));
    const norm = await ok.getSubscription('sub_x');
    expect(norm?.providerSubscriptionId).toBe('sub_x');
    expect(norm?.status).toBe('active');

    const notFound = polarWith(async () => {
      throw new PolarApiError({ status: 404, code: 'not_found', detail: null, message: 'nope' });
    });
    expect(await notFound.getSubscription('sub_x')).toBeNull();
  });

  it('propagates non-404 Polar errors', async () => {
    const boom = polarWith(async () => {
      throw new PolarApiError({ status: 500, code: 'server_error', detail: null, message: 'boom' });
    });
    await expect(boom.getSubscription('sub_x')).rejects.toBeInstanceOf(PolarApiError);
  });

  it('Stripe getSubscription throws inactive', async () => {
    await expect(new StripeProvider().getSubscription('sub_x')).rejects.toMatchObject({
      status: 500,
    });
  });
});

// ---------------------------------------------------------------------------
// F2/F3 — webhook cancel/revoke pause + dunning / reactivation notifications.
// ---------------------------------------------------------------------------
function subscriptionEvent(
  userId: string,
  action: 'canceled' | 'revoked' | 'active' | 'updated',
  over: Partial<NormalizedSubscription> = {},
): ParsedEvent {
  return {
    eventId: `e_${action}_${userId}`,
    type: `subscription.${action}`,
    timestamp: '0',
    payload: {
      kind: 'subscription',
      action,
      subscription: {
        providerSubscriptionId: `sub_${userId}`,
        providerCustomerId: 'pc',
        externalCustomerId: userId,
        productId: 'prod_pro',
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        ...over,
      },
      customer: { providerCustomerId: 'pc', email: 'c@example.com' },
    },
  };
}

describe('F2 direct cancel/revoke pauses over-cap projects', () => {
  it('pauses the newest project and flags selectionRequired (no prior past_due)', async () => {
    const u = await owner('cancel@example.com');
    await subFor(String(u._id), { status: 'active', planSlug: 'pro' });
    const oldest = await project(String(u._id), 'oldest');
    const newest = await project(String(u._id), 'newest');
    await dispatchEvent('polar', subscriptionEvent(String(u._id), 'canceled'));
    expect((await Project.findById(newest._id))?.paused).toBe(true);
    expect((await Project.findById(oldest._id))?.paused).toBe(false);
    const sub = await Subscription.findOne({ providerSubscriptionId: `sub_${u._id}` });
    expect(sub?.status).toBe('canceled');
    expect(sub?.selectionRequired).toBe(true);
    // pro→free retention narrows → grandfather window stamped.
    expect(await isRetentionGraceActive(String(u._id))).toBe(true);
  });

  it('revoked lands on Free the same way', async () => {
    const u = await owner('revoke@example.com');
    await subFor(String(u._id), { status: 'active', planSlug: 'pro' });
    await project(String(u._id), 'a');
    await project(String(u._id), 'b');
    await dispatchEvent('polar', subscriptionEvent(String(u._id), 'revoked'));
    expect(await Project.countDocuments({ owner: u._id, paused: true })).toBe(1);
  });
});

describe('F3 dunning / reactivation notifications on the webhook path', () => {
  it('sends the dunning email once on the past_due transition and not on repeat', async () => {
    const u = await owner('dun@example.com');
    await subFor(String(u._id), { status: 'active', planSlug: 'pro' });
    const notify = vi.fn(
      async (_e: LifecycleEvent, _c: LifecycleNotifyContext): Promise<void> => undefined,
    );
    setLifecycleNotifier({ notify } as LifecycleNotifier);
    // Transition into past_due.
    await dispatchEvent('polar', subscriptionEvent(String(u._id), 'updated', { status: 'past_due' }));
    // Repeat delivery — grace already set, no second email.
    await dispatchEvent('polar', subscriptionEvent(String(u._id), 'updated', { status: 'past_due' }));
    const dunning = notify.mock.calls.filter((c) => c[0] === 'dunning_started');
    expect(dunning).toHaveLength(1);
    expect(dunning[0]?.[1]).toMatchObject({ userId: String(u._id), planSlug: 'pro' });
    expect(dunning[0]?.[1].graceEndsAt).toBeInstanceOf(Date);
  });

  it('sends the reactivation email when a past_due subscription recovers', async () => {
    const u = await owner('react@example.com');
    await subFor(String(u._id), {
      status: 'past_due',
      planSlug: 'pro',
      graceEndsAt: new Date(Date.now() + GRACE_WINDOW_MS),
    });
    const notify = vi.fn(
      async (_e: LifecycleEvent, _c: LifecycleNotifyContext): Promise<void> => undefined,
    );
    setLifecycleNotifier({ notify } as LifecycleNotifier);
    await dispatchEvent('polar', subscriptionEvent(String(u._id), 'active'));
    const react = notify.mock.calls.filter((c) => c[0] === 'reactivated');
    expect(react).toHaveLength(1);
  });

  it('sends the downgrade-notice email once when grace expires', async () => {
    const u = await owner('lapse@example.com');
    await subFor(String(u._id), {
      status: 'past_due',
      planSlug: 'pro',
      graceEndsAt: new Date(Date.now() - 1000),
    });
    const notify = vi.fn(
      async (_e: LifecycleEvent, _c: LifecycleNotifyContext): Promise<void> => undefined,
    );
    setLifecycleNotifier({ notify } as LifecycleNotifier);
    await expireAllOverdueGraces();
    // Re-run: already demoted → no second email.
    await expireAllOverdueGraces();
    const expired = notify.mock.calls.filter((c) => c[0] === 'grace_expired');
    expect(expired).toHaveLength(1);
  });
});
