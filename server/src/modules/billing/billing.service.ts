import { HttpError } from '../../shared/utils/http-error.js';
import { findUserById } from '../users/index.js';
import { Project } from '../backups/backups.model.js';
import { Customer } from './customer.model.js';
import { Subscription } from './subscription.model.js';
import { getPaymentProvider } from './active-provider.js';
import { PricingTier } from './pricing-tier.model.js';
import { seedPricingTiers } from './pricing-tier.seed.js';
import { resolveEntitlements } from './entitlements.service.js';
import { selectProjectsToKeep } from './lifecycle.service.js';
import type { SelectProjectsInput } from './billing.schema.js';

async function loadUserOrThrow(userId: string) {
  const user = await findUserById(userId);
  if (!user) throw HttpError.notFound('billing.error.userNotFound');
  return user;
}

export async function startCheckoutForUser(
  userId: string,
  input: { productId: string; successUrl: string; cancelUrl?: string },
): Promise<{ url: string; providerCheckoutId: string }> {
  const user = await loadUserOrThrow(userId);
  const provider = getPaymentProvider();
  if (!provider.isConfigured()) {
    throw HttpError.internal('billing.error.notConfigured');
  }
  return provider.createCheckout({
    productId: input.productId,
    userId: String(user._id),
    email: user.email,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
  });
}

export async function openPortalForUser(userId: string): Promise<{ url: string }> {
  await loadUserOrThrow(userId);
  const provider = getPaymentProvider();
  if (!provider.isConfigured()) {
    throw HttpError.internal('billing.error.notConfigured');
  }
  const customer = await Customer.findOne({ userId, provider: provider.name });
  if (!customer) {
    throw HttpError.notFound('billing.error.noCustomer');
  }
  return provider.openPortal({ providerCustomerId: customer.providerCustomerId });
}

export async function changePlanForUser(
  userId: string,
  input: { productId: string },
): Promise<{ status: string }> {
  const provider = getPaymentProvider();
  if (!provider.isConfigured()) {
    throw HttpError.internal('billing.error.notConfigured');
  }
  const sub = await Subscription.findOne({ userId, provider: provider.name });
  if (!sub) {
    throw HttpError.notFound('billing.error.noSubscription');
  }
  const normalized = await provider.changePlan({
    providerSubscriptionId: sub.providerSubscriptionId,
    productId: input.productId,
  });
  return { status: normalized.status };
}

export interface PricingTierClient {
  slug: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  productIdMonthly: string | null;
  productIdYearly: string | null;
  caps: {
    projects: number | null;
    retentionDays: number;
    frequency: string;
  };
  flags: {
    schedules: boolean;
    emailAlerts: boolean;
    multiVps: boolean;
  };
}

/**
 * Read the persisted tiers, seeding on empty. `projects: Number.MAX_SAFE_INTEGER`
 * is returned to the client as `null` to mean "unlimited".
 */
export async function getPricingTiersForClient(): Promise<PricingTierClient[]> {
  const count = await PricingTier.countDocuments();
  if (count === 0) await seedPricingTiers();
  const tiers = await PricingTier.find({ active: true }).sort({ priceMonthly: 1 }).lean();
  return tiers.map((t) => {
    const caps = t.caps ?? { projects: 0, retentionDays: 0, frequency: 'daily' };
    const flags = t.flags ?? { schedules: false, emailAlerts: false, multiVps: false };
    return {
      slug: t.slug,
      name: t.name,
      priceMonthly: t.priceMonthly,
      priceYearly: t.priceYearly,
      productIdMonthly: t.productIdMonthly ?? null,
      productIdYearly: t.productIdYearly ?? null,
      caps: {
        projects:
          caps.projects >= Number.MAX_SAFE_INTEGER ? null : caps.projects,
        retentionDays: caps.retentionDays,
        frequency: caps.frequency,
      },
      flags: {
        schedules: flags.schedules,
        emailAlerts: flags.emailAlerts,
        multiVps: flags.multiVps,
      },
    };
  });
}

export interface BillingOverviewResponse {
  slug: string;
  status: 'active' | 'past_due' | 'canceled' | 'revoked' | 'none';
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  selectionRequired: boolean;
}

export async function getBillingOverviewForUser(
  userId: string,
): Promise<BillingOverviewResponse> {
  const resolved = await resolveEntitlements(userId);
  const provider = getPaymentProvider();
  const sub = provider.isConfigured()
    ? await Subscription.findOne({ userId, provider: provider.name })
        .sort({ createdAt: -1 })
        .lean()
    : null;
  return {
    slug: resolved.slug,
    status: resolved.status,
    currentPeriodEnd: sub?.currentPeriodEnd
      ? sub.currentPeriodEnd.toISOString()
      : null,
    graceEndsAt: resolved.graceEndsAt
      ? resolved.graceEndsAt.toISOString()
      : null,
    cancelAtPeriodEnd: Boolean(sub?.cancelAtPeriodEnd),
    selectionRequired: resolved.selectionRequired,
  };
}

export interface UsageResponse {
  projects: {
    used: number;
    cap: number | null;
    paused: Array<{ id: string; name: string }>;
    active: Array<{ id: string; name: string }>;
  };
  retentionDays: number;
  frequency: string;
  flags: { schedules: boolean; emailAlerts: boolean; multiVps: boolean };
  selectionRequired: boolean;
}

export async function getUsageForUser(userId: string): Promise<UsageResponse> {
  const resolved = await resolveEntitlements(userId);
  const projects = await Project.find({ owner: userId })
    .sort({ createdAt: 1 })
    .select('_id name paused')
    .lean();
  const active = projects
    .filter((p) => !p.paused)
    .map((p) => ({ id: String(p._id), name: p.name }));
  const paused = projects
    .filter((p) => p.paused)
    .map((p) => ({ id: String(p._id), name: p.name }));
  const cap = Number.isFinite(resolved.entitlements.projects)
    ? resolved.entitlements.projects
    : null;
  return {
    projects: { used: active.length, cap, paused, active },
    retentionDays: resolved.entitlements.retentionDays,
    frequency: resolved.entitlements.frequency,
    flags: {
      schedules: resolved.entitlements.schedules,
      emailAlerts: resolved.entitlements.emailAlerts,
      multiVps: resolved.entitlements.multiVps,
    },
    selectionRequired: resolved.selectionRequired,
  };
}

export async function selectProjectsForUser(
  userId: string,
  input: SelectProjectsInput,
): Promise<{ active: number; paused: number }> {
  return selectProjectsToKeep(userId, input.keepIds);
}
