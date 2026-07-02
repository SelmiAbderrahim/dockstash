import type { NormalizedSubscriptionStatus } from './payment-provider.js';
import type { SubscriptionStatusName } from './subscription.model.js';

/**
 * Map a provider-normalized subscription status onto the persisted local
 * status. Single source of truth for the webhook pipeline and the
 * reconciliation loop.
 *
 * `trialing` persists as `active` (trial grants access); `incomplete`
 * (checkout started, payment not settled) persists as `incomplete` and never
 * grants paid entitlements.
 */
export function toPersistedStatus(
  status: NormalizedSubscriptionStatus,
): SubscriptionStatusName {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'revoked':
      return 'revoked';
    case 'canceled':
      return 'canceled';
    case 'incomplete':
    default:
      return 'incomplete';
  }
}
