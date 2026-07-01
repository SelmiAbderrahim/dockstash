import type { PlanSlug } from './subscription.model.js';

export type ScheduleFrequency = 'daily' | 'hourly' | 'any-cron';

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
  },
  pro: {
    slug: 'pro',
    projects: 10,
    retentionDays: 30,
    frequency: 'hourly',
    schedules: true,
    emailAlerts: true,
    restoreDrills: true,
    multiVps: false,
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
  if (entitlements.frequency === 'any-cron') return true;
  if (entitlements.frequency === 'hourly') {
    return requested === 'daily' || requested === 'hourly';
  }
  return requested === 'daily';
}
