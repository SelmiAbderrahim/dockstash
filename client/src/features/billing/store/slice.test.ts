import { describe, expect, it } from 'vitest';
import { billingReducer, clearBillingMessages } from './slice';
import {
  changePlan,
  loadOverview,
  loadPricingTiers,
  loadUsage,
  openPortal,
  selectProjectsToKeep,
  startCheckout,
} from './thunks';
import type { BillingOverview, PricingTier, UsageResponse } from '../types';

const initial = () => billingReducer(undefined, { type: 'unknown' });

describe('billing slice — transitions', () => {
  it('starts empty', () => {
    const s = initial();
    expect(s.tiers).toEqual([]);
    expect(s.overview).toBeNull();
    expect(s.usage).toBeNull();
    expect(s.loadingTiers).toBe(false);
    expect(s.usageError).toBe('');
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

  it('loadOverview.pending sets loading; fulfilled stores overview', () => {
    const pending = billingReducer(initial(), { type: loadOverview.pending.type });
    expect(pending.loadingOverview).toBe(true);
    const overview: BillingOverview = {
      slug: 'pro',
      status: 'active',
      currentPeriodEnd: '2026-01-01',
      graceEndsAt: null,
      cancelAtPeriodEnd: false,
      selectionRequired: false,
    };
    const s = billingReducer(pending, {
      type: loadOverview.fulfilled.type,
      payload: overview,
    });
    expect(s.loadingOverview).toBe(false);
    expect(s.overview).toEqual(overview);
  });

  it('loadUsage.pending clears usageError; fulfilled stores usage', () => {
    const pending = billingReducer(
      { ...initial(), usageError: 'previous failure' },
      { type: loadUsage.pending.type },
    );
    expect(pending.loadingUsage).toBe(true);
    expect(pending.usageError).toBe('');
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
    const s = billingReducer(pending, {
      type: loadUsage.fulfilled.type,
      payload: usage,
    });
    expect(s.usage).toEqual(usage);
  });

  it('loadUsage.rejected sets usageError, not the page error', () => {
    const s = billingReducer(initial(), {
      type: loadUsage.rejected.type,
      payload: 'usage down',
    });
    expect(s.usageError).toBe('usage down');
    expect(s.error).toBe('');
    expect(s.loadingUsage).toBe(false);
  });

  it('startCheckout.rejected records error', () => {
    const s = billingReducer(initial(), {
      type: startCheckout.rejected.type,
      payload: 'oops',
    });
    expect(s.error).toBe('oops');
  });

  it('openPortal.rejected records error', () => {
    const s = billingReducer(initial(), {
      type: openPortal.rejected.type,
      payload: 'portal down',
    });
    expect(s.error).toBe('portal down');
  });

  it('changePlan.fulfilled sets message', () => {
    const s = billingReducer(initial(), {
      type: changePlan.fulfilled.type,
      payload: { status: 'active' },
    });
    expect(s.message).toBe('Plan updated.');
  });

  it('selectProjectsToKeep.fulfilled sets the saved message; rejected sets error', () => {
    const ok = billingReducer(initial(), {
      type: selectProjectsToKeep.fulfilled.type,
      payload: { active: 1, paused: 0 },
    });
    expect(ok.message).toBe('Selection saved.');
    const bad = billingReducer(initial(), {
      type: selectProjectsToKeep.rejected.type,
      payload: 'no',
    });
    expect(bad.error).toBe('no');
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

describe('billing slice — rejected fallbacks (undefined payload)', () => {
  const errorCases: Array<[string, string]> = [
    [loadPricingTiers.rejected.type, 'Could not load pricing tiers.'],
    [loadOverview.rejected.type, 'Could not load overview.'],
    [startCheckout.rejected.type, 'Could not start checkout.'],
    [openPortal.rejected.type, 'Could not open the billing portal.'],
    [changePlan.rejected.type, 'Could not change plan.'],
    [selectProjectsToKeep.rejected.type, 'Could not update selection.'],
  ];

  it.each(errorCases)('%s falls back to its default error message', (type, fallback) => {
    const s = billingReducer(initial(), { type, payload: undefined });
    expect(s.error).toBe(fallback);
  });

  it('loadUsage.rejected falls back onto usageError', () => {
    const s = billingReducer(initial(), {
      type: loadUsage.rejected.type,
      payload: undefined,
    });
    expect(s.usageError).toBe('Could not load usage.');
  });
});
