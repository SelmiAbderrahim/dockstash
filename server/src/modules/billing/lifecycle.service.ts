import { HttpError } from '../../shared/utils/http-error.js';
import { logger } from '../../config/logger.js';
import { DEFAULT_LOCALE, isSupportedLocale, translate } from '../../shared/i18n/index.js';
import type { SupportedLocale, TranslationVars } from '../../shared/i18n/index.js';
import { Project } from '../backups/backups.model.js';
import { Agent } from '../agents/agents.model.js';
import { Schedule } from '../scheduler/scheduler.model.js';
import { User } from '../users/index.js';
import {
  deliverDunningEmail,
  deliverDowngradeNoticeEmail,
  deliverReactivationEmail,
} from '../communication/index.js';
import { Order } from './order.model.js';
import {
  Subscription,
  findEffectiveSubscription,
  PLAN_SLUGS,
  type PlanSlug,
} from './subscription.model.js';
import { ENTITLEMENTS } from './plans.js';
import { getPlanForProductId } from './polar-config.js';
import { getPaymentProvider } from './active-provider.js';
import { reconcileAgentCounter, reconcileProjectCounter } from './entitlements.service.js';

export type Translator = (key: string, vars?: TranslationVars) => string;
const identityT: Translator = (key, vars) => translate(DEFAULT_LOCALE, key, vars);

/** Grace window between `past_due` and effective downgrade (IDEA.md §4). */
export const GRACE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// User notification (prompt 13 / F3). A single module-level notifier (mirrors
// `configureAgentJobEvents` / `setResendTransport`) turns the three
// entitlement-visible transitions into emails. Failure is ALWAYS non-fatal —
// a bounced email must never roll back a billing state transition.
// ---------------------------------------------------------------------------

export type LifecycleEvent = 'dunning_started' | 'grace_expired' | 'reactivated';

export interface LifecycleNotifyContext {
  userId: string;
  /** dunning_started / reactivated: the plan involved. grace_expired: the plan
   *  that lapsed. */
  planSlug: PlanSlug;
  /** Only set for dunning_started — the instant the grace window closes. */
  graceEndsAt?: Date | null;
}

export interface LifecycleNotifier {
  notify(event: LifecycleEvent, ctx: LifecycleNotifyContext): Promise<void>;
}

function planLabel(slug: PlanSlug): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

/** Default notifier: load the user's email + language, dispatch to the mailer. */
const defaultNotifier: LifecycleNotifier = {
  async notify(event, ctx) {
    const user = await User.findById(ctx.userId).select('email language').lean();
    if (!user?.email) return;
    const locale: SupportedLocale = isSupportedLocale(user.language)
      ? user.language
      : DEFAULT_LOCALE;
    const plan = planLabel(ctx.planSlug);
    switch (event) {
      case 'dunning_started':
        await deliverDunningEmail({
          email: user.email,
          plan,
          graceEndsAt: (ctx.graceEndsAt ?? new Date()).toISOString(),
          locale,
        });
        return;
      case 'grace_expired':
        await deliverDowngradeNoticeEmail({ email: user.email, plan, locale });
        return;
      case 'reactivated':
        await deliverReactivationEmail({ email: user.email, plan, locale });
        return;
    }
  },
};

let notifier: LifecycleNotifier = defaultNotifier;

/** Swap the lifecycle notifier (test injection / alternate transport). */
export function setLifecycleNotifier(next: LifecycleNotifier): void {
  notifier = next;
}

/** Restore the default (real-mailer) notifier. */
export function resetLifecycleNotifier(): void {
  notifier = defaultNotifier;
}

/**
 * Fire a lifecycle notification. NEVER throws — a rejected notifier is logged
 * and swallowed so the caller's state transition is unaffected.
 */
export async function notifyLifecycleEvent(
  event: LifecycleEvent,
  ctx: LifecycleNotifyContext,
): Promise<void> {
  try {
    await notifier.notify(event, ctx);
  } catch (err) {
    logger.error(
      { err, event, userId: ctx.userId },
      'billing.lifecycle: notify failed — non-fatal',
    );
  }
}

/**
 * Called by the webhook pipeline (prompt 06) when a subscription becomes
 * `past_due`. Idempotent: if the subscription is already in grace, the
 * existing `graceEndsAt` is kept — repeat webhook deliveries never reset the
 * clock. Returns `true` when the state changed.
 */
export async function beginDunning(
  providerSubscriptionId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const sub = await Subscription.findOne({ providerSubscriptionId });
  if (!sub) return false;
  if (sub.graceEndsAt && sub.graceEndsAt.getTime() > now.getTime()) {
    return false;
  }
  sub.status = 'past_due';
  sub.graceEndsAt = new Date(now.getTime() + GRACE_WINDOW_MS);
  await sub.save();
  logger.info(
    { providerSubscriptionId, graceEndsAt: sub.graceEndsAt.toISOString() },
    'billing.lifecycle: dunning started',
  );
  return true;
}

/**
 * Called by cron / on read to demote a `past_due` subscription whose grace
 * has expired. Also pauses over-cap projects when the effective tier's project
 * cap is exceeded (never deletes). No-op (`expired: false`) when the user's
 * effective subscription is not an overdue `past_due` row — e.g. they
 * re-subscribed and an active row now takes priority.
 */
export async function expireGraceIfNeeded(
  userId: string,
  now: Date = new Date(),
): Promise<{ expired: boolean; paused: number }> {
  const sub = await findEffectiveSubscription(userId, getPaymentProvider().name);
  if (!sub) return { expired: false, paused: 0 };
  if (sub.status !== 'past_due') return { expired: false, paused: 0 };
  if (!sub.graceEndsAt || sub.graceEndsAt.getTime() > now.getTime()) {
    return { expired: false, paused: 0 };
  }

  const priorSlug = sub.planSlug; // capture the lapsing tier before overwrite
  sub.status = 'canceled';
  sub.planSlug = 'free';
  await sub.save();
  logger.info({ userId }, 'billing.lifecycle: grace expired → free');
  const paused = await applyProjectCap(userId, 'free', { priorSlug, now });
  await notifyLifecycleEvent('grace_expired', { userId, planSlug: priorSlug });
  return { expired: true, paused };
}

/**
 * Cron entry point: sweep every `past_due` subscription whose grace window has
 * lapsed and demote it via `expireGraceIfNeeded`. One failing row never aborts
 * the sweep.
 */
export async function expireAllOverdueGraces(
  now: Date = new Date(),
): Promise<{ scanned: number; downgraded: number; paused: number }> {
  const overdue = await Subscription.find({
    status: 'past_due',
    graceEndsAt: { $lte: now },
  })
    .select('userId')
    .lean();
  let downgraded = 0;
  let paused = 0;
  for (const sub of overdue) {
    try {
      const result = await expireGraceIfNeeded(String(sub.userId), now);
      if (result.expired) downgraded += 1;
      paused += result.paused;
    } catch (err) {
      logger.error(
        { err, userId: String(sub.userId) },
        'billing.lifecycle: grace-expiry sweep row failed — continuing',
      );
    }
  }
  return { scanned: overdue.length, downgraded, paused };
}

export interface ApplyProjectCapOpts {
  /** The tier the user is leaving. When it had a wider retention ceiling than
   *  `targetSlug`, a grandfather window is stamped (prompt 13 / F1). */
  priorSlug?: PlanSlug;
  now?: Date;
}

/**
 * Apply a project cap by pausing (never deleting) over-cap projects. When the
 * user has more projects than the target tier allows, the newest projects are
 * paused; the oldest active one remains active — but the user may re-select
 * via `selectProjectToKeep`. Returns the count paused.
 *
 * Side effects on every free-landing / downgrade path (prompt 13):
 * - F1: stamps `retentionGraceUntil` when the prior tier's retention was wider.
 * - F5: disables (and tags) the overflow projects' currently-enabled schedules.
 * - F6: re-asserts the fleet cap, blocking newest-over-cap agents.
 */
export async function applyProjectCap(
  userId: string,
  targetSlug: PlanSlug,
  opts: ApplyProjectCapOpts = {},
): Promise<number> {
  const now = opts.now ?? new Date();
  // F1: grandfather pre-downgrade history. Stamp a grace window whenever the
  // tier the user left retained for longer than the tier they land on, so the
  // prune job keeps the wider policy (unclamped) until the window elapses.
  if (
    opts.priorSlug &&
    ENTITLEMENTS[opts.priorSlug].retentionDays > ENTITLEMENTS[targetSlug].retentionDays
  ) {
    await Subscription.updateOne(
      { userId, provider: { $exists: true } },
      { $set: { retentionGraceUntil: new Date(now.getTime() + GRACE_WINDOW_MS) } },
    );
  }
  // F6: re-assert the fleet cap regardless of the project count (a Business →
  // Pro downgrade shrinks agents even when projects still fit).
  await applyAgentCap(userId, targetSlug);

  const cap = ENTITLEMENTS[targetSlug].projects;
  if (!Number.isFinite(cap)) {
    // Infinite project tier still reconciles the agent counter for honesty.
    await reconcileAgentCounter(userId, await Agent.countDocuments({ owner: userId }));
    return 0;
  }
  const active = await Project.find({ owner: userId, paused: { $ne: true } })
    .sort({ createdAt: 1 })
    .select('_id');
  const overflow = active.slice(cap);
  if (overflow.length > 0) {
    const overflowIds = overflow.map((p) => p._id);
    await Project.updateMany(
      { _id: { $in: overflowIds } },
      { $set: { paused: true } },
    );
    // F5: a paused project's cron must stop firing. Disable only currently
    // ENABLED schedules and tag them so re-upgrade re-enables exactly these —
    // never a schedule the user independently disabled.
    await Schedule.updateMany(
      { project: { $in: overflowIds }, enabled: true },
      { $set: { enabled: false, pausedByBilling: true } },
    );
    await Subscription.updateOne(
      { userId, provider: { $exists: true } },
      { $set: { selectionRequired: true } },
    );
  }
  // Reconcile the reservation ledger to the post-pause active count so a
  // subsequent create is gated correctly under the new tier.
  await reconcileProjectCounter(userId, active.length - overflow.length);
  // Agents are never paused/deleted by a plan change; reconcile the agent
  // counter to the real count so the ledger stays honest (over-cap is
  // drift-high — safe — and only blocks NEW registration under the new tier).
  await reconcileAgentCounter(userId, await Agent.countDocuments({ owner: userId }));
  return overflow.length;
}

/**
 * F6: re-assert the fleet-agent cap for `targetSlug`. Blocks the newest agents
 * beyond the cap from leasing new jobs (never deletes) and unblocks any agent
 * that fits — so a re-upgrade to a larger (still finite) or infinite tier
 * releases the block. Newest-first, mirroring the project-pause ordering.
 */
async function applyAgentCap(userId: string, targetSlug: PlanSlug): Promise<void> {
  const cap = ENTITLEMENTS[targetSlug].agents;
  if (!Number.isFinite(cap)) {
    // Infinite fleet: nothing is ever blocked; clear any stale block.
    await Agent.updateMany(
      { owner: userId, blockedByBilling: true },
      { $set: { blockedByBilling: false } },
    );
    return;
  }
  const agents = await Agent.find({ owner: userId })
    .sort({ createdAt: 1 })
    .select('_id');
  const overflowIds = agents.slice(cap).map((a) => a._id);
  // Unblock everything within cap (idempotent + handles re-upgrade to a larger
  // finite tier).
  await Agent.updateMany(
    { owner: userId, _id: { $nin: overflowIds } },
    { $set: { blockedByBilling: false } },
  );
  if (overflowIds.length > 0) {
    await Agent.updateMany(
      { _id: { $in: overflowIds } },
      { $set: { blockedByBilling: true } },
    );
  }
}

/**
 * Called when a webhook indicates the customer has switched to a smaller
 * product. If the new tier's cap is smaller than the user's current active
 * project count, mark `selectionRequired=true` and pause over-cap projects
 * (newest first) — no deletion. The user re-selects via `selectProjectToKeep`.
 */
export async function handleDowngrade(
  userId: string,
  newProductId: string | null,
  priorSlug?: PlanSlug,
): Promise<{ selectionRequired: boolean; paused: number }> {
  const target = getPlanForProductId(newProductId);
  const paused = await applyProjectCap(userId, target, { priorSlug });
  return { selectionRequired: paused > 0, paused };
}

/**
 * Called when a subscription moves to a bigger product or reactivates
 * (non-active → active). If every project now fits under the new cap, unpause
 * them all and clear `selectionRequired`; when the user still exceeds the cap
 * they must re-select, so the paused set is left untouched. Idempotent — a
 * no-op when nothing is paused.
 */
export async function handleUpgrade(
  userId: string,
  newProductId: string | null,
): Promise<{ unpaused: number; selectionRequired: boolean }> {
  const target = getPlanForProductId(newProductId);
  const cap = ENTITLEMENTS[target].projects;
  const total = await Project.countDocuments({ owner: userId });
  // F6: re-assert the fleet cap for the (possibly larger) tier — unblocks
  // agents that now fit, even when projects still require a selection.
  await applyAgentCap(userId, target);
  if (Number.isFinite(cap) && total > cap) {
    await Subscription.updateMany(
      { userId },
      { $set: { selectionRequired: true } },
    );
    return { unpaused: 0, selectionRequired: true };
  }
  const pausedProjects = await Project.find({ owner: userId, paused: true })
    .select('_id');
  const result = await Project.updateMany(
    { owner: userId, paused: true },
    { $set: { paused: false } },
  );
  // F5: re-enable ONLY the schedules a billing pause disabled — never a
  // schedule the user disabled independently.
  await Schedule.updateMany(
    { project: { $in: pausedProjects.map((p) => p._id) }, pausedByBilling: true },
    { $set: { enabled: true, pausedByBilling: false } },
  );
  // Back on a paid tier: clear the retention grandfather stamp so the clamp
  // resumes at the (now wider) tier ceiling.
  await Subscription.updateMany(
    { userId },
    { $set: { selectionRequired: false, retentionGraceUntil: null } },
  );
  const unpaused = result.modifiedCount ?? 0;
  // Reconcile the reservation ledger: every project is now active.
  await reconcileProjectCounter(userId, total);
  if (unpaused > 0) {
    logger.info(
      { userId, unpaused, target },
      'billing.lifecycle: upgrade reactivated paused projects',
    );
  }
  return { unpaused, selectionRequired: false };
}

/**
 * Rank two plan slugs for upgrade/downgrade routing on webhook plan changes.
 * Positive → upgrade, negative → downgrade, 0 → lateral (e.g. monthly↔yearly).
 */
export function comparePlans(next: PlanSlug, prior: PlanSlug): number {
  return PLAN_SLUGS.indexOf(next) - PLAN_SLUGS.indexOf(prior);
}

/**
 * `order.refunded` → revoke entitlement to Free. Never deletes projects.
 */
export async function handleRefund(providerOrderId: string): Promise<boolean> {
  const order = await Order.findOne({ providerOrderId });
  if (!order) return false;
  if (order.status !== 'refunded') {
    order.status = 'refunded';
    await order.save();
  }
  if (!order.subscriptionId) return true;
  const sub = await Subscription.findById(order.subscriptionId);
  if (!sub) return true;
  const priorSlug = sub.planSlug; // capture the revoked tier before overwrite
  sub.status = 'revoked';
  sub.planSlug = 'free';
  await sub.save();
  await applyProjectCap(String(sub.userId), 'free', { priorSlug });
  logger.info(
    { providerOrderId, userId: String(sub.userId) },
    'billing.lifecycle: refund → free',
  );
  return true;
}

export interface SelectProjectDeps {
  t?: Translator;
}

/**
 * User picks the project(s) that stay active after a downgrade-over-cap.
 * All others (up to the tier cap) are paused. Never deletes.
 */
export async function selectProjectsToKeep(
  userId: string,
  keepIds: string[],
  deps: SelectProjectDeps = {},
): Promise<{ active: number; paused: number }> {
  const t = deps.t ?? identityT;
  const sub = await findEffectiveSubscription(
    userId,
    getPaymentProvider().name,
  );
  const slug: PlanSlug = sub?.planSlug ?? 'free';
  const cap = ENTITLEMENTS[slug].projects;
  const capped = Number.isFinite(cap) ? cap : Number.MAX_SAFE_INTEGER;
  if (keepIds.length === 0 || keepIds.length > capped) {
    throw HttpError.badRequest(t('billing.entitlements.selectionInvalid'), {
      reason: 'selectionInvalid',
      cap: Number.isFinite(cap) ? cap : null,
    });
  }
  const owned = await Project.find({ owner: userId, _id: { $in: keepIds } })
    .select('_id')
    .lean();
  if (owned.length !== keepIds.length) {
    throw HttpError.forbidden(t('billing.entitlements.notOwner'), {
      reason: 'notOwner',
    });
  }
  await Project.updateMany(
    { owner: userId, _id: { $in: keepIds } },
    { $set: { paused: false } },
  );
  const pausedResult = await Project.updateMany(
    { owner: userId, _id: { $nin: keepIds } },
    { $set: { paused: true } },
  );
  // F5: kept projects re-enable exactly the schedules a billing pause disabled;
  // non-kept projects have their still-enabled schedules disabled + tagged.
  await Schedule.updateMany(
    { owner: userId, project: { $in: keepIds }, pausedByBilling: true },
    { $set: { enabled: true, pausedByBilling: false } },
  );
  await Schedule.updateMany(
    { owner: userId, project: { $nin: keepIds }, enabled: true },
    { $set: { enabled: false, pausedByBilling: true } },
  );
  if (sub) {
    sub.selectionRequired = false;
    await sub.save();
    // F6: unblock agents that fit the effective tier after selection.
    await applyAgentCap(userId, slug);
  }
  // Reconcile the reservation ledger to the post-selection active count.
  const activeCount = await Project.countDocuments({
    owner: userId,
    paused: { $ne: true },
  });
  await reconcileProjectCounter(userId, activeCount);
  return {
    active: keepIds.length,
    paused: pausedResult.modifiedCount ?? 0,
  };
}

