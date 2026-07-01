import { HttpError } from '../../shared/utils/http-error.js';
import { DEFAULT_LOCALE, translate } from '../../shared/i18n/index.js';
import type { TranslationVars } from '../../shared/i18n/index.js';
import { getPaymentProvider } from './active-provider.js';
import { Subscription } from './subscription.model.js';
import type { PlanSlug } from './subscription.model.js';
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
  status: 'active' | 'past_due' | 'canceled' | 'revoked' | 'none';
  graceEndsAt: Date | null;
}

/**
 * Resolve the effective entitlements for a user. Behaviour by state:
 * - No paid provider configured (OSS default) → the highest OSS ceiling
 *   (`business` matrix) so self-hosters are unrestricted.
 * - No subscription row → `free`.
 * - `active` → the tier from `planSlug`.
 * - `past_due` within grace (`graceEndsAt > now`) → keep paid entitlements.
 * - `past_due` past grace, `canceled`, `revoked` → `free`.
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

  const sub = await Subscription.findOne({ userId, provider: provider.name })
    .sort({ createdAt: -1 })
    .lean();

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
      cap: Number.isFinite(resolved.entitlements.projects)
        ? resolved.entitlements.projects
        : null,
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

/**
 * Classify a cron expression into a coarse frequency bucket. Used by the
 * schedule-create guard when the client sends raw cron and we need to check
 * frequency against the tier. Conservative: unknown → `any-cron` so tiers
 * that don't allow arbitrary cron (`free`, `pro`) reject correctly.
 */
export function classifyCron(expr: string): ScheduleFrequency {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return 'any-cron';
  const minute = parts[0] ?? '';
  const hour = parts[1] ?? '';
  if (minute === '*' || minute.includes('*/') || minute.includes('-') || minute.includes(',')) {
    return 'any-cron';
  }
  if (hour === '*' || hour.includes('*/') || hour.includes('-') || hour.includes(',')) {
    return 'hourly';
  }
  return 'daily';
}
