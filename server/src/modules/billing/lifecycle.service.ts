import { HttpError } from '../../shared/utils/http-error.js';
import { logger } from '../../config/logger.js';
import { DEFAULT_LOCALE, translate } from '../../shared/i18n/index.js';
import type { TranslationVars } from '../../shared/i18n/index.js';
import { Project } from '../backups/backups.model.js';
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
import { reconcileProjectCounter } from './entitlements.service.js';

export type Translator = (key: string, vars?: TranslationVars) => string;
const identityT: Translator = (key, vars) => translate(DEFAULT_LOCALE, key, vars);

/** Grace window between `past_due` and effective downgrade (IDEA.md §4). */
export const GRACE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export type LifecycleEvent =
  | 'dunning_started'
  | 'grace_expired'
  | 'downgrade_selection_required'
  | 'refunded'
  | 'reactivated';

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

  sub.status = 'canceled';
  sub.planSlug = 'free';
  await sub.save();
  logger.info({ userId }, 'billing.lifecycle: grace expired → free');
  const paused = await applyProjectCap(userId, 'free');
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

/**
 * Apply a project cap by pausing (never deleting) over-cap projects. When the
 * user has more projects than the target tier allows, the newest projects are
 * paused; the oldest active one remains active — but the user may re-select
 * via `selectProjectToKeep`. Returns the count paused.
 */
export async function applyProjectCap(
  userId: string,
  targetSlug: PlanSlug,
): Promise<number> {
  const cap = ENTITLEMENTS[targetSlug].projects;
  if (!Number.isFinite(cap)) return 0;
  const active = await Project.find({ owner: userId, paused: { $ne: true } })
    .sort({ createdAt: 1 })
    .select('_id');
  const overflow = active.slice(cap);
  if (overflow.length > 0) {
    await Project.updateMany(
      { _id: { $in: overflow.map((p) => p._id) } },
      { $set: { paused: true } },
    );
    await Subscription.updateOne(
      { userId, provider: { $exists: true } },
      { $set: { selectionRequired: true } },
    );
  }
  // Reconcile the reservation ledger to the post-pause active count so a
  // subsequent create is gated correctly under the new tier.
  await reconcileProjectCounter(userId, active.length - overflow.length);
  return overflow.length;
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
): Promise<{ selectionRequired: boolean; paused: number }> {
  const target = getPlanForProductId(newProductId);
  const paused = await applyProjectCap(userId, target);
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
  if (Number.isFinite(cap) && total > cap) {
    await Subscription.updateMany(
      { userId },
      { $set: { selectionRequired: true } },
    );
    return { unpaused: 0, selectionRequired: true };
  }
  const result = await Project.updateMany(
    { owner: userId, paused: true },
    { $set: { paused: false } },
  );
  await Subscription.updateMany(
    { userId },
    { $set: { selectionRequired: false } },
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
  sub.status = 'revoked';
  sub.planSlug = 'free';
  await sub.save();
  await applyProjectCap(String(sub.userId), 'free');
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
  if (sub) {
    sub.selectionRequired = false;
    await sub.save();
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

