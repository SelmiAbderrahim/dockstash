import { env } from '../../config/env.js';
import type { PlanSlug } from './subscription.model.js';

export type BillingInterval = 'month' | 'year';

/**
 * Extended plan key including yearly variants. The persisted slug on
 * `Subscription.planSlug` is always the base `PlanSlug` (`free`/`pro`/
 * `business`); the interval is derived from the product id via
 * `getIntervalForProductId()`.
 */
export type PlanKey =
  | 'free'
  | 'pro'
  | 'business'
  | 'pro_yearly'
  | 'business_yearly';

interface ProductMappingEntry {
  slug: PlanSlug;
  interval: BillingInterval;
  envKey?:
    | 'POLAR_PRO_PRODUCT_ID'
    | 'POLAR_BUSINESS_PRODUCT_ID'
    | 'POLAR_PRO_YEARLY_PRODUCT_ID'
    | 'POLAR_BUSINESS_YEARLY_PRODUCT_ID';
}

const PLAN_TO_PRODUCT_ENTRIES: Record<PlanKey, ProductMappingEntry> = {
  free: { slug: 'free', interval: 'month' },
  pro: { slug: 'pro', interval: 'month', envKey: 'POLAR_PRO_PRODUCT_ID' },
  business: {
    slug: 'business',
    interval: 'month',
    envKey: 'POLAR_BUSINESS_PRODUCT_ID',
  },
  pro_yearly: {
    slug: 'pro',
    interval: 'year',
    envKey: 'POLAR_PRO_YEARLY_PRODUCT_ID',
  },
  business_yearly: {
    slug: 'business',
    interval: 'year',
    envKey: 'POLAR_BUSINESS_YEARLY_PRODUCT_ID',
  },
};

function readProductId(key: PlanKey): string | null {
  const entry = PLAN_TO_PRODUCT_ENTRIES[key];
  if (!entry.envKey) return null;
  const value = (env as unknown as Record<string, string | undefined>)[entry.envKey];
  return value && value.length > 0 ? value : null;
}

/**
 * Dynamic view of the plan-key → product-id mapping. Uses a Proxy so callers
 * can inspect it like a normal object (`PLAN_TO_PRODUCT.pro`) while still
 * getting the CURRENT env at call time — necessary because product IDs are
 * read from env, and tests mutate env after module load.
 */
export const PLAN_TO_PRODUCT: Record<PlanKey, string | null> = new Proxy(
  {} as Record<PlanKey, string | null>,
  {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined;
      if (prop in PLAN_TO_PRODUCT_ENTRIES) return readProductId(prop as PlanKey);
      return undefined;
    },
    ownKeys() {
      return Object.keys(PLAN_TO_PRODUCT_ENTRIES);
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (typeof prop !== 'string' || !(prop in PLAN_TO_PRODUCT_ENTRIES)) return undefined;
      return {
        enumerable: true,
        configurable: true,
        value: readProductId(prop as PlanKey),
      };
    },
  },
);

/**
 * `product_id` → plan slug. Product id is the source of truth (see IDEA.md §3).
 * Unknown/undefined → `free` (safe default). Never trust checkout metadata to
 * resolve a plan.
 */
export function getPlanForProductId(
  productId: string | undefined | null,
): PlanSlug {
  if (!productId) return 'free';
  for (const key of Object.keys(PLAN_TO_PRODUCT_ENTRIES) as PlanKey[]) {
    if (readProductId(key) === productId) {
      return PLAN_TO_PRODUCT_ENTRIES[key].slug;
    }
  }
  return 'free';
}

export function getIntervalForProductId(
  productId: string | undefined | null,
): BillingInterval {
  if (!productId) return 'month';
  for (const key of Object.keys(PLAN_TO_PRODUCT_ENTRIES) as PlanKey[]) {
    if (readProductId(key) === productId) {
      return PLAN_TO_PRODUCT_ENTRIES[key].interval;
    }
  }
  return 'month';
}

export function getProductIdForPlan(
  slug: PlanSlug,
  interval: BillingInterval = 'month',
): string | null {
  for (const key of Object.keys(PLAN_TO_PRODUCT_ENTRIES) as PlanKey[]) {
    const entry = PLAN_TO_PRODUCT_ENTRIES[key];
    if (entry.slug === slug && entry.interval === interval) {
      return readProductId(key);
    }
  }
  return null;
}
