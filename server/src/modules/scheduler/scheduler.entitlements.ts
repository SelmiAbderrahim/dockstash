import { resolveEntitlements } from '../billing/entitlements.service.js';
import type { EntitlementChecker } from './scheduler.boundaries.js';
import type { JobKind } from './scheduler.model.js';

/**
 * Test/bootstrap fallback — always allow. Production wiring swaps in
 * `billingEntitlements` (server.ts → startScheduler options).
 */
export const allowAllEntitlements: EntitlementChecker = {
  async canEnqueue() {
    return true;
  },
};

/**
 * Plan-gated kinds. Everything else (backup / prune / check / restore) is a
 * baseline capability on every tier — manual runs must always work so a free
 * user can still back up and get their data back.
 */
function isKindAllowed(kind: JobKind, flags: { restoreDrills: boolean }): boolean {
  if (kind === 'drill') return flags.restoreDrills;
  return true;
}

/**
 * Billing-backed enqueue gate: resolves the owner's effective plan and checks
 * the job kind against its feature flags. Frequency ceilings are enforced
 * earlier, at schedule-create (`assertScheduleAllowed`); this hook is the last
 * line before a job enters the queue (covers ad-hoc enqueues and legacy
 * schedules created before a downgrade).
 */
export const billingEntitlements: EntitlementChecker = {
  async canEnqueue(owner, kind) {
    const resolved = await resolveEntitlements(owner);
    return isKindAllowed(kind, {
      restoreDrills: resolved.entitlements.restoreDrills,
    });
  },
};
