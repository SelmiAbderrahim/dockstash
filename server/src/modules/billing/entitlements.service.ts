import { HttpError } from '../../shared/utils/http-error.js';
import { env } from '../../config/env.js';
import { DEFAULT_LOCALE, translate } from '../../shared/i18n/index.js';
import type { TranslationVars } from '../../shared/i18n/index.js';
import { getPaymentProvider } from './active-provider.js';
import { findEffectiveSubscription } from './subscription.model.js';
import type { PlanSlug, SubscriptionStatusName } from './subscription.model.js';
import {
  ENTITLEMENTS,
  getEntitlements,
  isFrequencyAllowed,
  type Entitlements,
  type ScheduleFrequency,
} from './plans.js';
import { UsageCounter } from './usage-counter.model.js';

export type Translator = (key: string, vars?: TranslationVars) => string;
const identityT: Translator = (key, vars) => translate(DEFAULT_LOCALE, key, vars);

export interface ResolvedEntitlements {
  slug: PlanSlug;
  entitlements: Entitlements;
  selectionRequired: boolean;
  status: SubscriptionStatusName | 'none';
  graceEndsAt: Date | null;
}

/**
 * Resolve the effective entitlements for a user. Behaviour by state:
 * - Billing intentionally disabled (`PAYMENT_PROVIDER=none`, OSS self-host) →
 *   the highest ceiling (`business` matrix) so self-hosters are unrestricted.
 * - No subscription row → `free`.
 * - `active` → the tier from `planSlug`.
 * - `past_due` within grace (`graceEndsAt > now`) → keep paid entitlements.
 * - `past_due` past grace, `incomplete`, `canceled`, `revoked` → `free`.
 *
 * NOTE: the OSS-unrestricted branch is gated on the operator explicitly opting
 * out of billing (`PAYMENT_PROVIDER=none`) — NOT on whether the provider is
 * `isConfigured()`. A selected-but-uncredentialled paid provider (e.g.
 * `PAYMENT_PROVIDER=polar` with an empty `POLAR_ACCESS_TOKEN`) must fail SAFE to
 * `free`, never fail open by handing every user the business ceiling for free.
 */
export async function resolveEntitlements(
  userId: string,
): Promise<ResolvedEntitlements> {
  const provider = getPaymentProvider();
  if (env.PAYMENT_PROVIDER === 'none') {
    return {
      slug: 'business',
      entitlements: ENTITLEMENTS.business,
      selectionRequired: false,
      status: 'none',
      graceEndsAt: null,
    };
  }

  const sub = await findEffectiveSubscription(userId, provider.name);

  if (!sub) {
    return {
      slug: 'free',
      entitlements: ENTITLEMENTS.free,
      selectionRequired: false,
      status: 'none',
      graceEndsAt: null,
    };
  }

  const now = Date.now();
  const graceEndsAt = sub.graceEndsAt ?? null;
  let slug: PlanSlug = 'free';

  if (sub.status === 'active') {
    slug = sub.planSlug;
  } else if (sub.status === 'past_due') {
    if (graceEndsAt && graceEndsAt.getTime() > now) {
      slug = sub.planSlug;
    } else {
      slug = 'free';
    }
  }

  return {
    slug,
    entitlements: getEntitlements(slug),
    selectionRequired: Boolean(sub.selectionRequired),
    status: sub.status,
    graceEndsAt,
  };
}

export interface AssertProjectCapDeps {
  t?: Translator;
  countActiveProjects: (userId: string) => Promise<number>;
}

/**
 * Render a numeric cap for the client: a finite ceiling is returned as-is;
 * the infinite (business) ceiling is surfaced as `null` ("unlimited").
 */
export function capForClient(projects: number): number | null {
  return Number.isFinite(projects) ? projects : null;
}

/**
 * Enforce project cap before Backup-Now on a NEW active project (i.e. count
 * strictly greater than cap after this project would be counted). Throws 403
 * `billing.entitlements.projectLimitReached` when over cap.
 */
export async function assertProjectCap(
  userId: string,
  deps: AssertProjectCapDeps,
): Promise<ResolvedEntitlements> {
  const t = deps.t ?? identityT;
  const resolved = await resolveEntitlements(userId);
  const activeCount = await deps.countActiveProjects(userId);
  if (activeCount > resolved.entitlements.projects) {
    throw HttpError.forbidden(t('billing.entitlements.projectLimitReached'), {
      reason: 'projectLimitReached',
      cap: capForClient(resolved.entitlements.projects),
      used: activeCount,
    });
  }
  return resolved;
}

export interface AssertScheduleDeps {
  t?: Translator;
  frequency: ScheduleFrequency;
}

/**
 * Enforce schedule feature-flag + frequency cap before schedule-create.
 * Two distinct 403 codes so the client can render two distinct upgrade
 * prompts: `schedulesLocked` (feature unavailable) and `frequencyNotAllowed`.
 */
export async function assertScheduleAllowed(
  userId: string,
  deps: AssertScheduleDeps,
): Promise<ResolvedEntitlements> {
  const t = deps.t ?? identityT;
  const resolved = await resolveEntitlements(userId);
  if (!resolved.entitlements.schedules) {
    throw HttpError.forbidden(t('billing.entitlements.schedulesLocked'), {
      reason: 'schedulesLocked',
    });
  }
  if (!isFrequencyAllowed(resolved.entitlements, deps.frequency)) {
    throw HttpError.forbidden(t('billing.entitlements.frequencyNotAllowed'), {
      reason: 'frequencyNotAllowed',
      allowed: resolved.entitlements.frequency,
      requested: deps.frequency,
    });
  }
  return resolved;
}

/**
 * Enforce the restore-drill feature flag (Pro+). Throws 403
 * `billing.entitlements.restoreDrillsLocked` on the free tier so the client can
 * render an upgrade prompt.
 */
export async function assertRestoreDrillAllowed(
  userId: string,
  deps: { t?: Translator } = {},
): Promise<ResolvedEntitlements> {
  const t = deps.t ?? identityT;
  const resolved = await resolveEntitlements(userId);
  if (!resolved.entitlements.restoreDrills) {
    throw HttpError.forbidden(t('billing.entitlements.restoreDrillsLocked'), {
      reason: 'restoreDrillsLocked',
    });
  }
  return resolved;
}

/**
 * Whether the user's plan includes email alerts (Pro+). Used by the alert and
 * heartbeat senders to skip delivery for tiers without the feature.
 */
export async function isEmailAlertsAllowed(userId: string): Promise<boolean> {
  const resolved = await resolveEntitlements(userId);
  return resolved.entitlements.emailAlerts;
}

/**
 * Enforce the outbound-alert-channel flag (email/webhook, Pro+ — same
 * `emailAlerts` entitlement). Throws 403 `billing.entitlements.alertsLocked`
 * so the client can render an upgrade prompt on the webhook settings form.
 */
export async function assertAlertsAllowed(
  userId: string,
  deps: { t?: Translator } = {},
): Promise<ResolvedEntitlements> {
  const t = deps.t ?? identityT;
  const resolved = await resolveEntitlements(userId);
  if (!resolved.entitlements.emailAlerts) {
    throw HttpError.forbidden(t('billing.entitlements.alertsLocked'), {
      reason: 'alertsLocked',
    });
  }
  return resolved;
}

/**
 * Enforce the multi-VPS fleet feature (Business). Throws 403
 * `billing.entitlements.multiVpsLocked` for tiers without it.
 */
export async function assertMultiVpsAllowed(
  userId: string,
  deps: { t?: Translator } = {},
): Promise<ResolvedEntitlements> {
  const t = deps.t ?? identityT;
  const resolved = await resolveEntitlements(userId);
  if (!resolved.entitlements.multiVps) {
    throw HttpError.forbidden(t('billing.entitlements.multiVpsLocked'), {
      reason: 'multiVpsLocked',
    });
  }
  return resolved;
}

/**
 * Clamp a retention window (in days) to the tier ceiling. Never widens; only
 * narrows. Callers pass the requested `keep --days` and receive the effective
 * value to hand to `restic forget`.
 */
export async function clampRetentionDays(
  userId: string,
  requestedDays: number,
): Promise<number> {
  const resolved = await resolveEntitlements(userId);
  return Math.min(requestedDays, resolved.entitlements.retentionDays);
}

export interface RetentionPolicyShape {
  keepDaily: number;
  keepWeekly: number;
  keepMonthly: number;
  /** Continuous-backup keeps; 0/undefined = flag omitted from `restic forget`. */
  keepHourly?: number;
  keepLast?: number;
}

/**
 * Ceiling for `--keep-last` regardless of tier: one day of 5-minute snapshots.
 * Guards restic memory/prune cost on continuous schedules.
 */
export const KEEP_LAST_MAX = 288;

/**
 * Clamp a restic keep-count retention policy to the tier's retention ceiling
 * (in days). Never widens; only narrows: daily keeps are capped at the tier's
 * day count, weekly/monthly keeps at the equivalent number of weeks/months.
 * The prune job calls this so a downgraded user cannot retain beyond their
 * tier by keeping an old, wider policy on the schedule.
 */
export async function clampRetentionPolicy(
  userId: string,
  policy: RetentionPolicyShape,
): Promise<RetentionPolicyShape> {
  const tierDays = (await resolveEntitlements(userId)).entitlements.retentionDays;
  const clamped: RetentionPolicyShape = {
    keepDaily: Math.min(policy.keepDaily, tierDays),
    keepWeekly: Math.min(policy.keepWeekly, Math.ceil(tierDays / 7)),
    keepMonthly: Math.min(policy.keepMonthly, Math.ceil(tierDays / 30)),
  };
  if (policy.keepHourly !== undefined) {
    // Hourly keeps live inside the tier's day window.
    clamped.keepHourly = Math.min(policy.keepHourly, tierDays * 24);
  }
  if (policy.keepLast !== undefined) {
    clamped.keepLast = Math.min(policy.keepLast, KEEP_LAST_MAX);
  }
  return clamped;
}

/**
 * Enforce the one-way mirror flag (Business). Throws 403
 * `billing.entitlements.mirrorLocked` for tiers without it.
 */
export async function assertMirrorAllowed(
  userId: string,
  deps: { t?: Translator } = {},
): Promise<ResolvedEntitlements> {
  const t = deps.t ?? identityT;
  const resolved = await resolveEntitlements(userId);
  if (!resolved.entitlements.mirror) {
    throw HttpError.forbidden(t('billing.entitlements.mirrorLocked'), {
      reason: 'mirrorLocked',
    });
  }
  return resolved;
}

/**
 * Enforce the point-in-time-restore resolver flag (Pro+). Throws 403
 * `billing.entitlements.pitrLocked` on the free tier so the client can render
 * an upgrade prompt.
 */
export async function assertPitrAllowed(
  userId: string,
  deps: { t?: Translator } = {},
): Promise<ResolvedEntitlements> {
  const t = deps.t ?? identityT;
  const resolved = await resolveEntitlements(userId);
  if (!resolved.entitlements.pitrRestore) {
    throw HttpError.forbidden(t('billing.entitlements.pitrLocked'), {
      reason: 'pitrLocked',
    });
  }
  return resolved;
}

/**
 * Classify a cron expression into a coarse frequency bucket. Used by the
 * schedule-create guard when the client sends raw cron and we need to check
 * frequency against the tier. Conservative: unknown → `any-cron` so tiers
 * that don't allow arbitrary cron (`free`, `pro`) reject correctly.
 */
export function classifyCron(expr: string): ScheduleFrequency {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return 'any-cron';
  /* c8 ignore next -- a 5-field split always yields a defined [0]; `?? ''` is defensive */
  const minute = parts[0] ?? '';
  /* c8 ignore next -- a 5-field split always yields a defined [1]; `?? ''` is defensive */
  const hour = parts[1] ?? '';
  // Pure minute step (`*/N * * * *`): the continuous near-PITR shape. Steps of
  // 5 minutes or coarser classify as `continuous` (Pro); finer steps stay
  // `any-cron` (Business). Anything else non-fixed (lists, ranges, bare `*`)
  // stays conservatively `any-cron`.
  const stepMatch = /^\*\/(\d+)$/.exec(minute);
  if (stepMatch !== null && hour === '*') {
    const step = Number(stepMatch[1]);
    return step >= 5 ? 'continuous' : 'any-cron';
  }
  if (minute === '*' || minute.includes('*/') || minute.includes('-') || minute.includes(',')) {
    return 'any-cron';
  }
  if (hour === '*' || hour.includes('*/') || hour.includes('-') || hour.includes(',')) {
    return 'hourly';
  }
  return 'daily';
}

// ---------------------------------------------------------------------------
// Reservation ledger — atomic project-cap enforcement (S3-01 / S3-03).
// The per-owner UsageCounter is the single source of truth for "how many
// active projects does this user have". `reserveProjectSlot` increments
// BEFORE `Project.create` so a concurrent second request at `remaining == 1`
// fails the `$lt cap` atomic guard — closing the TOCTOU window between
// `countDocuments` and `Project.create`.
// ---------------------------------------------------------------------------

export interface ReserveProjectSlotDeps {
  t?: Translator;
  /** Fallback counter (unused when the ledger row exists; kept for the
   *  bootstrap-reconciliation path and test injection). */
  countActiveProjects?: (userId: string) => Promise<number>;
}

/**
 * Atomically reserve a project slot by incrementing the per-owner counter
 * BEFORE the Project record is created. On the infinite (business) tier no
 * counter row is ever written. At cap, throws 403 `projectLimitReached`.
 *
 * The `findOneAndUpdate`/`updateOne` with `{ projects: { $lt: cap } }` filter
 * is the sole concurrency authority: exactly one concurrent request can
 * succeed at `remaining == 1`; the rest fail the filter or collide on the
 * unique `owner` index (E11000 → caught and retried without upsert).
 */
export async function reserveProjectSlot(
  userId: string,
  deps: ReserveProjectSlotDeps = {},
): Promise<void> {
  const t = deps.t ?? identityT;
  const resolved = await resolveEntitlements(userId);
  const cap = resolved.entitlements.projects;
  // Infinite tier (business / OSS self-host): no counter row is ever written.
  if (!Number.isFinite(cap)) return;

  const filter = { owner: userId, projects: { $lt: cap } };
  const update = { $inc: { projects: 1 } };

  try {
    const result = await UsageCounter.updateOne(filter, update, { upsert: true });
    if (result.matchedCount > 0 || result.upsertedCount > 0) return;
    // Filter didn't match → at cap.
    throw HttpError.forbidden(t('billing.entitlements.projectLimitReached'), {
      reason: 'projectLimitReached',
      cap: capForClient(cap),
    });
  } catch (err) {
    // E11000 (dup key on upsert) means a concurrent bootstrap insert won the
    // race — the row now exists. Fall through to a second atomic attempt
    // WITHOUT upsert so we don't collide again.
    if ((err as { code?: number }).code === 11000) {
      const retry = await UsageCounter.updateOne(filter, update);
      if (retry.matchedCount > 0) return;
      throw HttpError.forbidden(t('billing.entitlements.projectLimitReached'), {
        reason: 'projectLimitReached',
        cap: capForClient(cap),
      });
    }
    throw err;
  }
}

/**
 * Release a previously reserved slot (decrement, clamped at zero). Called on
 * `createProject` failure rollback and on project pause/delete.
 */
export async function releaseProjectSlot(userId: string): Promise<void> {
  // Only decrement if the counter is above zero — never goes negative.
  await UsageCounter.updateOne(
    { owner: userId, projects: { $gt: 0 } },
    { $inc: { projects: -1 } },
  );
}

/**
 * Adjust the counter by a signed delta. `delta === 0` is a no-op (no row
 * created). Negative deltas clamp at zero via `$max`.
 */
export async function adjustProjectCounter(
  userId: string,
  delta: number,
): Promise<void> {
  if (delta === 0) return;
  // Aggregation-pipeline update: $inc + $max on the same field in one plain
  // update doc is rejected by MongoDB as a path conflict, so clamp via a
  // computed $set instead — still a single atomic op.
  await UsageCounter.updateOne(
    { owner: userId },
    [{ $set: { projects: { $max: [{ $add: [{ $ifNull: ['$projects', 0] }, delta] }, 0] } } }],
    { upsert: true },
  );
}

/**
 * Reconcile the counter to an absolute value (clamped ≥ 0). Used by the
 * lifecycle paths (pause/unpause/select) to correct drift after bulk state
 * changes. Upserts the row if it doesn't exist.
 */
export async function reconcileProjectCounter(
  userId: string,
  count: number,
): Promise<void> {
  const clamped = Math.max(0, count);
  await UsageCounter.updateOne(
    { owner: userId },
    { $set: { projects: clamped } },
    { upsert: true },
  );
}
