import { logger } from '../../config/logger.js';
import { NodeCronScheduler } from '../scheduler/scheduler.cron.node.js';
import { Subscription } from './subscription.model.js';
import type { IPaymentProvider, NormalizedSubscription } from './payment-provider.js';
import { getPaymentProvider } from './active-provider.js';

export interface ReconciliationSummary {
  polled: number;
  healed: number;
  errors: number;
}

function toPersistedStatus(status: NormalizedSubscription['status']): 'active' | 'past_due' | 'canceled' | 'revoked' {
  switch (status) {
    case 'active':
    case 'trialing':
    case 'incomplete':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'revoked':
      return 'revoked';
    case 'canceled':
    default:
      return 'canceled';
  }
}

interface LocalSubShape {
  status: string;
  cancelAtPeriodEnd?: boolean | null;
  currentPeriodEnd?: Date | null;
}

function subscriptionsDiffer(
  local: LocalSubShape,
  remote: NormalizedSubscription,
): boolean {
  const targetStatus = toPersistedStatus(remote.status);
  if (local.status !== targetStatus) return true;
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
      local.status = toPersistedStatus(norm.status);
      local.cancelAtPeriodEnd = norm.cancelAtPeriodEnd;
      local.currentPeriodEnd = norm.currentPeriodEnd;
      await local.save();
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

const RECONCILE_CRON_ID = 'billing.reconcile';
const RECONCILE_CRON_EXPR = '*/15 * * * *'; // every 15 min
let sharedScheduler: NodeCronScheduler | null = null;

function scheduler(): NodeCronScheduler {
  if (!sharedScheduler) sharedScheduler = new NodeCronScheduler();
  return sharedScheduler;
}

export function registerReconciliationCron(): void {
  scheduler().register(RECONCILE_CRON_ID, RECONCILE_CRON_EXPR, async () => {
    const summary = await reconcileSubscriptions();
    logger.info({ ...summary }, 'billing.reconcile: run complete');
  });
}

export function unregisterReconciliationCron(): void {
  scheduler().unregister(RECONCILE_CRON_ID);
}
