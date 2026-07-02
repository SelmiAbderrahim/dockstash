import { describe, expect, it } from 'vitest';
import { toPersistedStatus } from './status-map.js';
import type { NormalizedSubscriptionStatus } from './payment-provider.js';
import type { SubscriptionStatusName } from './subscription.model.js';

describe('toPersistedStatus', () => {
  const table: Array<[NormalizedSubscriptionStatus, SubscriptionStatusName]> = [
    ['active', 'active'],
    ['trialing', 'active'],
    ['past_due', 'past_due'],
    ['canceled', 'canceled'],
    ['revoked', 'revoked'],
    ['incomplete', 'incomplete'],
  ];

  it.each(table)('%s → %s', (normalized, persisted) => {
    expect(toPersistedStatus(normalized)).toBe(persisted);
  });

  it('defensively maps an unknown status to incomplete (never entitled)', () => {
    expect(
      toPersistedStatus('mystery' as NormalizedSubscriptionStatus),
    ).toBe('incomplete');
  });
});
