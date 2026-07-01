import { PLAN_SLUGS, type PlanSlug } from './subscription.model.js';
import {
  ENTITLEMENTS,
  PRICE_MONTHLY_CENTS,
  PRICE_YEARLY_CENTS,
} from './plans.js';
import { getProductIdForPlan } from './polar-config.js';
import { PricingTier } from './pricing-tier.model.js';

const TIER_NAMES: Record<PlanSlug, string> = {
  free: 'Free',
  pro: 'Pro',
  business: 'Business',
};

/**
 * Idempotent seeder. Upserts one `PricingTier` row per plan slug from the
 * in-memory matrix. Re-running never duplicates rows or overwrites edits to
 * fields the merchant may have tweaked (`priceMonthly`/`priceYearly`,
 * `active`); only the matrix-owned caps/flags reconcile every run. Only
 * `$setOnInsert` is used for the mutable pricing/active fields so an admin
 * edit to a row survives future seed runs.
 */
export async function seedPricingTiers(): Promise<void> {
  for (const slug of PLAN_SLUGS) {
    const ent = ENTITLEMENTS[slug];
    const capsProjects = Number.isFinite(ent.projects)
      ? ent.projects
      : Number.MAX_SAFE_INTEGER;
    await PricingTier.findOneAndUpdate(
      { slug },
      {
        $set: {
          slug,
          name: TIER_NAMES[slug],
          productIdMonthly: getProductIdForPlan(slug, 'month'),
          productIdYearly: getProductIdForPlan(slug, 'year'),
          caps: {
            projects: capsProjects,
            retentionDays: ent.retentionDays,
            frequency: ent.frequency,
          },
          flags: {
            schedules: ent.schedules,
            emailAlerts: ent.emailAlerts,
            multiVps: ent.multiVps,
          },
        },
        $setOnInsert: {
          priceMonthly: PRICE_MONTHLY_CENTS[slug],
          priceYearly: PRICE_YEARLY_CENTS[slug],
          interval: 'month',
          active: true,
        },
      },
      { upsert: true, setDefaultsOnInsert: true, new: true },
    );
  }
}
