import { logger } from '../../config/logger.js';
import { Subscription } from './subscription.model.js';
import type { IPaymentProvider, NormalizedSubscription } from './payment-provider.js';
import { getPaymentProvider } from './active-provider.js';
import { toPersistedStatus } from './status-map.js';
import { getPlanForProductId } from './polar-config.js';
import { comparePlans, handleDowngrade, handleUpgrade } from './lifecycle.service.js';

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
 * Poll the provider for its active subscriptions and heal drift on local rows.
 *
 * - Never creates a row that Polar does not report.
 * - One failing record MUST NOT abort the loop — log + continue.
 * - Idempotent: re-running heals to the same final state.
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
  for (const norm of remote) {
    try {
      const local = await Subscription.findOne({
        provider: provider.name,
        providerSubscriptionId: norm.providerSubscriptionId,
      });
      if (!local) continue;
      if (!subscriptionsDiffer(local, norm)) continue;
      const priorSlug = local.planSlug;
      const priorStatus = local.status;
      const nextSlug = getPlanForProductId(norm.productId);
      local.status = toPersistedStatus(norm.status);
      local.productId = norm.productId;
      local.planSlug = nextSlug;
      local.cancelAtPeriodEnd = norm.cancelAtPeriodEnd;
      local.currentPeriodEnd = norm.currentPeriodEnd;
      await local.save();
      // Mirror the webhook side effects so a healed plan change also heals
      // the paused-project set (settled payment only).
      if (local.status === 'active') {
        if (priorSlug !== nextSlug) {
          if (comparePlans(nextSlug, priorSlug) < 0) {
            await handleDowngrade(String(local.userId), norm.productId);
          } else {
            await handleUpgrade(String(local.userId), norm.productId);
          }
        } else if (priorStatus !== 'active') {
          await handleUpgrade(String(local.userId), norm.productId);
        }
      }
      healed += 1;
    } catch (err) {
      errors += 1;
      logger.error(
        { err, providerSubscriptionId: norm.providerSubscriptionId },
        'billing.reconcile: record failed — continuing',
      );
    }
  }
  return { polled: remote.length, healed, errors };
}
