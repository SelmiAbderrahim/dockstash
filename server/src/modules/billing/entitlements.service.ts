import { HttpError } from '../../shared/utils/http-error.js';
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
 * - No paid provider configured (OSS default) → the highest OSS ceiling
 *   (`business` matrix) so self-hosters are unrestricted.
 * - No subscription row → `free`.
 * - `active` → the tier from `planSlug`.
 * - `past_due` within grace (`graceEndsAt > now`) → keep paid entitlements.
 * - `past_due` past grace, `incomplete`, `canceled`, `revoked` → `free`.
 */
export async function resolveEntitlements(
  userId: string,
): Promise<ResolvedEntitlements> {
  const provider = getPaymentProvider();
  if (!provider.isConfigured()) {
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
}

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
  return {
    keepDaily: Math.min(policy.keepDaily, tierDays),
    keepWeekly: Math.min(policy.keepWeekly, Math.ceil(tierDays / 7)),
    keepMonthly: Math.min(policy.keepMonthly, Math.ceil(tierDays / 30)),
  };
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
  if (minute === '*' || minute.includes('*/') || minute.includes('-') || minute.includes(',')) {
    return 'any-cron';
  }
  if (hour === '*' || hour.includes('*/') || hour.includes('-') || hour.includes(',')) {
    return 'hourly';
  }
  return 'daily';
}
