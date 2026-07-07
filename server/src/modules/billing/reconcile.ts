import { logger } from '../../config/logger.js';
import { Subscription, type SubscriptionHydrated } from './subscription.model.js';
import type { IPaymentProvider, NormalizedSubscription } from './payment-provider.js';
import { getPaymentProvider } from './active-provider.js';
import { toPersistedStatus } from './status-map.js';
import { getPlanForProductId } from './polar-config.js';
import {
  applyProjectCap,
  comparePlans,
  handleDowngrade,
  handleUpgrade,
  notifyLifecycleEvent,
} from './lifecycle.service.js';

export interface ReconciliationSummary {
  polled: number;
  healed: number;
  errors: number;
}

interface LocalSubShape {
  status: string;
  productId?: string | null;
  cancelAtPeriodEnd?: boolean | null;
  currentPeriodEnd?: Date | null;
}

function subscriptionsDiffer(
  local: LocalSubShape,
  remote: NormalizedSubscription,
): boolean {
  const targetStatus = toPersistedStatus(remote.status);
  if (local.status !== targetStatus) return true;
  if (local.productId !== remote.productId) return true;
  if (Boolean(local.cancelAtPeriodEnd) !== remote.cancelAtPeriodEnd) return true;
  const localMs = local.currentPeriodEnd ? new Date(local.currentPeriodEnd).getTime() : null;
  const remoteMs = remote.currentPeriodEnd ? remote.currentPeriodEnd.getTime() : null;
  if (localMs !== remoteMs) return true;
  return false;
}

/**
 * Apply a provider snapshot onto a local row and mirror the webhook side
 * effects. Shared by the active-listing loop AND the F4 orphan second pass so
 * both feed the SAME healer (never a duplicated transition path). Returns
 * whether the row was changed.
 */
async function healLocalFromRemote(
  local: SubscriptionHydrated,
  norm: NormalizedSubscription,
): Promise<boolean> {
  if (!subscriptionsDiffer(local, norm)) return false;
  const priorSlug = local.planSlug;
  const priorStatus = local.status;
  const nextSlug = getPlanForProductId(norm.productId);
  local.status = toPersistedStatus(norm.status);
  local.productId = norm.productId;
  local.planSlug = nextSlug;
  local.cancelAtPeriodEnd = norm.cancelAtPeriodEnd;
  local.currentPeriodEnd = norm.currentPeriodEnd;
  await local.save();
  const userId = String(local.userId);
  if (local.status === 'active') {
    if (priorSlug !== nextSlug) {
      if (comparePlans(nextSlug, priorSlug) < 0) {
        await handleDowngrade(userId, norm.productId, priorSlug);
      } else {
        await handleUpgrade(userId, norm.productId);
      }
    } else if (priorStatus !== 'active') {
      await handleUpgrade(userId, norm.productId);
      await notifyLifecycleEvent('reactivated', { userId, planSlug: nextSlug });
    }
  } else if (local.status === 'canceled' || local.status === 'revoked') {
    // Terminal status healed from the provider must pause over-cap projects,
    // same as every other free-landing path (prompt 13 / F2 parity).
    await applyProjectCap(userId, 'free', { priorSlug });
  }
  return true;
}

/**
 * Poll the provider for its active subscriptions and heal drift on local rows.
 *
 * - Never creates a row that Polar does not report.
 * - One failing record MUST NOT abort the loop — log + continue.
 * - Idempotent: re-running heals to the same final state.
 * - F4: local `active`/`past_due` rows absent from the active listing are
 *   revisited by id via `getSubscription` so a dropped terminal webhook can no
 *   longer strand paid entitlements indefinitely.
 */
export async function reconcileSubscriptions(
  providerOverride?: IPaymentProvider,
): Promise<ReconciliationSummary> {
  const provider = providerOverride ?? getPaymentProvider();
  if (!provider.isConfigured()) {
    return { polled: 0, healed: 0, errors: 0 };
  }
  let remote: NormalizedSubscription[] = [];
  try {
    remote = await provider.listActiveSubscriptions();
  } catch (err) {
    logger.error({ err }, 'billing.reconcile: listActiveSubscriptions failed');
    return { polled: 0, healed: 0, errors: 1 };
  }
  let healed = 0;
  let errors = 0;
  const seen = new Set<string>();
  for (const norm of remote) {
    seen.add(norm.providerSubscriptionId);
    try {
      const local = await Subscription.findOne({
        provider: provider.name,
        providerSubscriptionId: norm.providerSubscriptionId,
      });
      if (!local) continue;
      if (await healLocalFromRemote(local, norm)) healed += 1;
    } catch (err) {
      errors += 1;
      logger.error(
        { err, providerSubscriptionId: norm.providerSubscriptionId },
        'billing.reconcile: record failed — continuing',
      );
    }
  }

  // F4 second pass: local paid rows the active listing did not report.
  const orphans = await Subscription.find({
    provider: provider.name,
    status: { $in: ['active', 'past_due'] },
    providerSubscriptionId: { $nin: [...seen] },
  });
  for (const local of orphans) {
    try {
      const fetched = await provider.getSubscription(local.providerSubscriptionId);
      if (!fetched) {
        // Provider no longer knows this subscription → it fully ended. Heal to
        // canceled/free and pause over-cap projects.
        const priorSlug = local.planSlug;
        local.status = 'canceled';
        local.planSlug = 'free';
        await local.save();
        await applyProjectCap(String(local.userId), 'free', { priorSlug });
        healed += 1;
        continue;
      }
      if (await healLocalFromRemote(local, fetched)) healed += 1;
    } catch (err) {
      errors += 1;
      logger.error(
        { err, providerSubscriptionId: local.providerSubscriptionId },
        'billing.reconcile: orphan heal failed — continuing',
      );
    }
  }
  return { polled: remote.length, healed, errors };
}
