import type { PlanSlug } from './subscription.model.js';

export type ScheduleFrequency = 'daily' | 'hourly' | 'continuous' | 'any-cron';

/**
 * Coarse-to-fine ordering for frequency tiers. A plan whose ceiling ranks at
 * N allows any requested frequency ranking <= N. `continuous` is the Pro
 * near-PITR tier: sub-hourly step schedules with a 5-minute floor; `any-cron`
 * (Business) additionally allows arbitrary expressions down to 1 minute.
 */
export const FREQUENCY_RANK: Record<ScheduleFrequency, number> = {
  daily: 0,
  hourly: 1,
  continuous: 2,
  'any-cron': 3,
};

/** Finest schedule interval (minutes) each frequency ceiling permits. */
export const MIN_INTERVAL_MINUTES: Record<ScheduleFrequency, number> = {
  daily: 1440,
  hourly: 60,
  continuous: 5,
  'any-cron': 1,
};

export interface Entitlements {
  slug: PlanSlug;
  projects: number;
  retentionDays: number;
  frequency: ScheduleFrequency;
  schedules: boolean;
  emailAlerts: boolean;
  /** Automated restore-drill verification (Pro+). */
  restoreDrills: boolean;
  multiVps: boolean;
  /** Point-in-time restore resolver (nearest snapshot <= timestamp, Pro+). */
  pitrRestore: boolean;
  /** One-way directory mirror jobs (Business). */
  mirror: boolean;
}

/**
 * In-memory entitlements matrix. Single source of truth for what each plan
 * unlocks. `PricingTier` seeds from this; runtime enforcement reads from it
 * via `resolveEntitlements()` in `entitlements.service.ts`.
 */
export const ENTITLEMENTS: Record<PlanSlug, Entitlements> = {
  free: {
    slug: 'free',
    projects: 1,
    retentionDays: 7,
    frequency: 'daily',
    schedules: false,
    emailAlerts: false,
    restoreDrills: false,
    multiVps: false,
    pitrRestore: false,
    mirror: false,
  },
  pro: {
    slug: 'pro',
    projects: 10,
    retentionDays: 30,
    frequency: 'continuous',
    schedules: true,
    emailAlerts: true,
    restoreDrills: true,
    multiVps: false,
    pitrRestore: true,
    mirror: false,
  },
  business: {
    slug: 'business',
    projects: Number.POSITIVE_INFINITY,
    retentionDays: 90,
    frequency: 'any-cron',
    schedules: true,
    emailAlerts: true,
    restoreDrills: true,
    multiVps: true,
    pitrRestore: true,
    mirror: true,
  },
};

export function getEntitlements(slug: PlanSlug): Entitlements {
  return ENTITLEMENTS[slug];
}

/** Monthly price in USD cents. Free = 0. */
export const PRICE_MONTHLY_CENTS: Record<PlanSlug, number> = {
  free: 0,
  pro: 900,
  business: 2900,
};

/** Yearly = monthly * 10 ("2 months free"). */
export const PRICE_YEARLY_CENTS: Record<PlanSlug, number> = {
  free: 0,
  pro: PRICE_MONTHLY_CENTS.pro * 10,
  business: PRICE_MONTHLY_CENTS.business * 10,
};

export function isFrequencyAllowed(
  entitlements: Entitlements,
  requested: ScheduleFrequency,
): boolean {
  return FREQUENCY_RANK[requested] <= FREQUENCY_RANK[entitlements.frequency];
}

/** Finest schedule interval (minutes) the plan permits. */
export function minIntervalMinutes(entitlements: Entitlements): number {
  return MIN_INTERVAL_MINUTES[entitlements.frequency];
}
