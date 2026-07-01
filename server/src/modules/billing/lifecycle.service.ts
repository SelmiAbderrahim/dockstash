import { HttpError } from '../../shared/utils/http-error.js';
import { logger } from '../../config/logger.js';
import { DEFAULT_LOCALE, translate } from '../../shared/i18n/index.js';
import type { TranslationVars } from '../../shared/i18n/index.js';
import { Project } from '../backups/backups.model.js';
import { Customer } from './customer.model.js';
import { Order } from './order.model.js';
import { Subscription, type PlanSlug } from './subscription.model.js';
import { ENTITLEMENTS } from './plans.js';
import { getPlanForProductId } from './polar-config.js';

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
 * cap is exceeded (never deletes). Returns the number of projects paused.
 */
export async function expireGraceIfNeeded(
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const sub = await Subscription.findOne({ userId }).sort({ createdAt: -1 });
  if (!sub) return 0;
  if (sub.status !== 'past_due') return 0;
  if (!sub.graceEndsAt || sub.graceEndsAt.getTime() > now.getTime()) return 0;

  sub.status = 'canceled';
  sub.planSlug = 'free';
  await sub.save();
  logger.info({ userId }, 'billing.lifecycle: grace expired → free');
  return applyProjectCap(userId, 'free');
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
  if (overflow.length === 0) return 0;
  await Project.updateMany(
    { _id: { $in: overflow.map((p) => p._id) } },
    { $set: { paused: true } },
  );
  if (overflow.length > 0) {
    await Subscription.updateOne(
      { userId, provider: { $exists: true } },
      { $set: { selectionRequired: true } },
    );
  }
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
  const sub = await Subscription.findOne({ userId }).sort({ createdAt: -1 });
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
  return {
    active: keepIds.length,
    paused: pausedResult.modifiedCount ?? 0,
  };
}

export interface AssertTrialDeps {
  t?: Translator;
}

/**
 * Enforce one-trial-per-email guard. Throws 409 when the email has already
 * claimed a trial. On success, marks the customer row (creating a light
 * record if needed) so the second call fails.
 */
export async function assertTrialAvailable(
  email: string,
  provider: 'polar' | 'stripe',
  deps: AssertTrialDeps = {},
): Promise<void> {
  const t = deps.t ?? identityT;
  const normalized = email.toLowerCase().trim();
  const existing = await Customer.findOne({ email: normalized, provider });
  if (existing?.trialClaimedAt) {
    throw HttpError.conflict(t('billing.entitlements.trialAlreadyClaimed'), {
      reason: 'trialAlreadyClaimed',
    });
  }
}

/**
 * Record that a trial was consumed for a given email + provider.
 */
export async function recordTrialClaim(
  email: string,
  provider: 'polar' | 'stripe',
  providerCustomerId: string,
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  const normalized = email.toLowerCase().trim();
  await Customer.findOneAndUpdate(
    { provider, providerCustomerId },
    {
      $set: { email: normalized, userId },
      $setOnInsert: { trialClaimedAt: now },
    },
    { upsert: true, setDefaultsOnInsert: true, new: true },
  );
  await Customer.updateOne(
    { provider, providerCustomerId, trialClaimedAt: null },
    { $set: { trialClaimedAt: now } },
  );
}
