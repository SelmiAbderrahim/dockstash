import { logger } from '../../config/logger.js';
import { NodeCronScheduler } from '../scheduler/scheduler.cron.node.js';
import type { SchedulerCron } from '../scheduler/scheduler.boundaries.js';
import { getPaymentProvider } from './active-provider.js';
import { reconcileSubscriptions } from './reconcile.js';
import { expireAllOverdueGraces } from './lifecycle.service.js';
import { sweepExpiredInviteGrants } from './invitation.service.js';

export const RECONCILE_CRON_ID = 'billing.reconcile';
export const RECONCILE_CRON_EXPR = '*/15 * * * *'; // every 15 min
export const GRACE_EXPIRY_CRON_ID = 'billing.grace-expiry';
export const GRACE_EXPIRY_CRON_EXPR = '0 * * * *'; // hourly
export const INVITE_GRANT_EXPIRY_CRON_ID = 'billing.invite-grant-expiry';
export const INVITE_GRANT_EXPIRY_CRON_EXPR = '30 3 * * *'; // nightly

let sharedScheduler: NodeCronScheduler | null = null;

function defaultScheduler(): NodeCronScheduler {
  if (!sharedScheduler) sharedScheduler = new NodeCronScheduler();
  return sharedScheduler;
}

export interface BillingCronDeps {
  scheduler?: SchedulerCron;
}

/**
 * Register the billing background jobs: subscription-drift reconciliation
 * (heals missed/failed webhooks against the provider) and grace-window expiry
 * (demotes overdue `past_due` subscriptions). Called once at boot from
 * `server.ts`. Returns `false` (registering nothing) when no payment provider
 * is configured — OSS/self-host mode has no drift to heal.
 */
export function registerBillingCrons(deps: BillingCronDeps = {}): boolean {
  if (!getPaymentProvider().isConfigured()) {
    logger.info('billing.cron: provider not configured — crons not registered');
    return false;
  }
  const scheduler = deps.scheduler ?? defaultScheduler();
  scheduler.register(RECONCILE_CRON_ID, RECONCILE_CRON_EXPR, async () => {
    const summary = await reconcileSubscriptions();
    logger.info({ ...summary }, 'billing.reconcile: run complete');
  });
  scheduler.register(GRACE_EXPIRY_CRON_ID, GRACE_EXPIRY_CRON_EXPR, async () => {
    const summary = await expireAllOverdueGraces();
    logger.info({ ...summary }, 'billing.grace-expiry: run complete');
  });
  scheduler.register(INVITE_GRANT_EXPIRY_CRON_ID, INVITE_GRANT_EXPIRY_CRON_EXPR, async () => {
    const summary = await sweepExpiredInviteGrants();
    logger.info({ ...summary }, 'billing.invite-grant-expiry: run complete');
  });
  return true;
}

export function unregisterBillingCrons(deps: BillingCronDeps = {}): void {
  const scheduler = deps.scheduler ?? defaultScheduler();
  scheduler.unregister(RECONCILE_CRON_ID);
  scheduler.unregister(GRACE_EXPIRY_CRON_ID);
  scheduler.unregister(INVITE_GRANT_EXPIRY_CRON_ID);
}
