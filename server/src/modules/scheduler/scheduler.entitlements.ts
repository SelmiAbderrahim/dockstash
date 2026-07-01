import type { EntitlementChecker } from './scheduler.boundaries.js';

/**
 * Prompt-05 placeholder — always allow. Prompt 07 replaces this with the
 * `plans.ts` cap check (frequency + max schedules per plan).
 */
export const allowAllEntitlements: EntitlementChecker = {
  async canEnqueue() {
    return true;
  },
};
