import { describe, expect, it } from 'vitest';
import {
  ENTITLEMENTS,
  getEntitlements,
  isFrequencyAllowed,
  PRICE_MONTHLY_CENTS,
  PRICE_YEARLY_CENTS,
} from './plans.js';

describe('plans / getEntitlements', () => {
  it('returns the matrix row for each slug', () => {
    expect(getEntitlements('free')).toBe(ENTITLEMENTS.free);
    expect(getEntitlements('pro')).toBe(ENTITLEMENTS.pro);
    expect(getEntitlements('business')).toBe(ENTITLEMENTS.business);
  });
});

describe('plans / prices', () => {
  it('derives yearly from monthly (2 months free)', () => {
    expect(PRICE_MONTHLY_CENTS.free).toBe(0);
    expect(PRICE_YEARLY_CENTS.pro).toBe(PRICE_MONTHLY_CENTS.pro * 10);
    expect(PRICE_YEARLY_CENTS.business).toBe(PRICE_MONTHLY_CENTS.business * 10);
  });
});

describe('plans / isFrequencyAllowed', () => {
  it('any-cron allows everything', () => {
    expect(isFrequencyAllowed(ENTITLEMENTS.business, 'daily')).toBe(true);
    expect(isFrequencyAllowed(ENTITLEMENTS.business, 'hourly')).toBe(true);
    expect(isFrequencyAllowed(ENTITLEMENTS.business, 'any-cron')).toBe(true);
  });

  it('hourly allows daily + hourly but not any-cron', () => {
    expect(isFrequencyAllowed(ENTITLEMENTS.pro, 'daily')).toBe(true);
    expect(isFrequencyAllowed(ENTITLEMENTS.pro, 'hourly')).toBe(true);
    expect(isFrequencyAllowed(ENTITLEMENTS.pro, 'any-cron')).toBe(false);
  });

  it('daily allows only daily', () => {
    expect(isFrequencyAllowed(ENTITLEMENTS.free, 'daily')).toBe(true);
    expect(isFrequencyAllowed(ENTITLEMENTS.free, 'hourly')).toBe(false);
    expect(isFrequencyAllowed(ENTITLEMENTS.free, 'any-cron')).toBe(false);
  });
});
