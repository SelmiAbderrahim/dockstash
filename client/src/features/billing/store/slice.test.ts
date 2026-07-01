import { describe, expect, it } from 'vitest';
import { billingReducer, clearBillingMessages } from './slice';
import {
  cancelSubscription,
  changePlan,
  createCustomer,
  fetchCustomer,
  loadOverview,
  loadPricingTiers,
  loadUsage,
  selectProjectsToKeep,
  startCheckout,
  updateBilling,
  updateSubscription,
} from './thunks';
import type {
  BillingOverview,
  PricingTier,
  UsageResponse,
} from '../types';

const initial = () => billingReducer(undefined, { type: 'unknown' });

describe('billing slice — prompt 07 transitions', () => {
  it('starts empty', () => {
    const s = initial();
    expect(s.tiers).toEqual([]);
    expect(s.overview).toBeNull();
    expect(s.usage).toBeNull();
    expect(s.loadingTiers).toBe(false);
  });

  it('loadPricingTiers.pending sets loading + clears error', () => {
    const s = billingReducer(
      { ...initial(), error: 'x' },
      { type: loadPricingTiers.pending.type },
    );
    expect(s.loadingTiers).toBe(true);
    expect(s.error).toBe('');
  });

  it('loadPricingTiers.fulfilled populates tiers', () => {
    const tiers: PricingTier[] = [
      {
        slug: 'free',
        name: 'Free',
        priceMonthly: 0,
        priceYearly: 0,
        productIdMonthly: null,
        productIdYearly: null,
        caps: { projects: 1, retentionDays: 7, frequency: 'daily' },
        flags: { schedules: false, emailAlerts: false, multiVps: false },
      },
    ];
    const s = billingReducer(initial(), {
      type: loadPricingTiers.fulfilled.type,
      payload: tiers,
    });
    expect(s.loadingTiers).toBe(false);
    expect(s.tiers).toEqual(tiers);
  });

  it('loadOverview.fulfilled stores overview', () => {
    const overview: BillingOverview = {
      slug: 'pro',
      status: 'active',
      currentPeriodEnd: '2026-01-01',
      graceEndsAt: null,
      cancelAtPeriodEnd: false,
      selectionRequired: false,
    };
    const s = billingReducer(initial(), {
      type: loadOverview.fulfilled.type,
      payload: overview,
    });
    expect(s.overview).toEqual(overview);
  });

  it('loadUsage.fulfilled stores usage', () => {
    const usage: UsageResponse = {
      projects: { used: 2, cap: 10, active: [], paused: [] },
      metering: [
        {
          id: 'p1',
          name: 'proj-1',
          sizeBytes: 2048,
          snapshotCount: 3,
          lastRunAt: '2026-07-01T00:00:00.000Z',
          lastStatus: 'success',
        },
      ],
      retentionDays: 30,
      frequency: 'hourly',
      flags: { schedules: true, emailAlerts: true, multiVps: false },
      selectionRequired: false,
    };
    const s = billingReducer(initial(), {
      type: loadUsage.fulfilled.type,
      payload: usage,
    });
    expect(s.usage).toEqual(usage);
  });

  it('startCheckout.rejected records error', () => {
    const s = billingReducer(initial(), {
      type: startCheckout.rejected.type,
      payload: 'oops',
    });
    expect(s.error).toBe('oops');
  });

  it('changePlan.fulfilled sets message', () => {
    const s = billingReducer(initial(), {
      type: changePlan.fulfilled.type,
      payload: { status: 'active' },
    });
    expect(s.message).toBe('Plan updated.');
  });

  it('selectProjectsToKeep.rejected sets error', () => {
    const s = billingReducer(initial(), {
      type: selectProjectsToKeep.rejected.type,
      payload: 'no',
    });
    expect(s.error).toBe('no');
  });

  it('clearBillingMessages clears message + error', () => {
    const s = billingReducer(
      { ...initial(), message: 'm', error: 'e' },
      clearBillingMessages(),
    );
    expect(s.message).toBe('');
    expect(s.error).toBe('');
  });
});

describe('billing slice — legacy fulfilled messages', () => {
  it('createCustomer.fulfilled sets message', () => {
    const s = billingReducer(initial(), {
      type: createCustomer.fulfilled.type,
      payload: 'started',
    });
    expect(s.message).toBe('started');
  });

  it('fetchCustomer.fulfilled stores the customer', () => {
    const s = billingReducer(initial(), {
      type: fetchCustomer.fulfilled.type,
      payload: { sources: { total_count: 0, data: [] } },
    });
    expect(s.customer).toEqual({ sources: { total_count: 0, data: [] } });
  });

  it('cancelSubscription.fulfilled sets message', () => {
    const s = billingReducer(initial(), {
      type: cancelSubscription.fulfilled.type,
      payload: 'canceled',
    });
    expect(s.message).toBe('canceled');
  });

  it('updateSubscription.fulfilled sets message', () => {
    const s = billingReducer(initial(), {
      type: updateSubscription.fulfilled.type,
      payload: 'changed',
    });
    expect(s.message).toBe('changed');
  });

  it('updateBilling.fulfilled sets message', () => {
    const s = billingReducer(initial(), {
      type: updateBilling.fulfilled.type,
      payload: 'updated',
    });
    expect(s.message).toBe('updated');
  });

  it('selectProjectsToKeep.fulfilled sets the saved message', () => {
    const s = billingReducer(initial(), {
      type: selectProjectsToKeep.fulfilled.type,
      payload: { active: 1, paused: 0 },
    });
    expect(s.message).toBe('Selection saved.');
  });
});

describe('billing slice — rejected fallbacks (undefined payload)', () => {
  const cases: Array<[string, string]> = [
    [createCustomer.rejected.type, 'Billing error.'],
    [fetchCustomer.rejected.type, 'Billing error.'],
    [cancelSubscription.rejected.type, 'Billing error.'],
    [updateSubscription.rejected.type, 'Billing error.'],
    [updateBilling.rejected.type, 'Billing error.'],
    [loadPricingTiers.rejected.type, 'Could not load pricing tiers.'],
    [loadOverview.rejected.type, 'Could not load overview.'],
    [loadUsage.rejected.type, 'Could not load usage.'],
    [startCheckout.rejected.type, 'Could not start checkout.'],
    [changePlan.rejected.type, 'Could not change plan.'],
    [selectProjectsToKeep.rejected.type, 'Could not update selection.'],
  ];

  it.each(cases)('%s falls back to its default error message', (type, fallback) => {
    const s = billingReducer(initial(), { type, payload: undefined });
    expect(s.error).toBe(fallback);
  });
});
