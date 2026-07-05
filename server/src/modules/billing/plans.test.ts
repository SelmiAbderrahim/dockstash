import { describe, expect, it } from 'vitest';
import {
  ENTITLEMENTS,
  getEntitlements,
  isFrequencyAllowed,
  minIntervalMinutes,
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
  it('any-cron (business) allows everything', () => {
    expect(isFrequencyAllowed(ENTITLEMENTS.business, 'daily')).toBe(true);
    expect(isFrequencyAllowed(ENTITLEMENTS.business, 'hourly')).toBe(true);
    expect(isFrequencyAllowed(ENTITLEMENTS.business, 'continuous')).toBe(true);
    expect(isFrequencyAllowed(ENTITLEMENTS.business, 'any-cron')).toBe(true);
  });

  it('continuous (pro) allows daily + hourly + continuous but not any-cron', () => {
    expect(isFrequencyAllowed(ENTITLEMENTS.pro, 'daily')).toBe(true);
    expect(isFrequencyAllowed(ENTITLEMENTS.pro, 'hourly')).toBe(true);
    expect(isFrequencyAllowed(ENTITLEMENTS.pro, 'continuous')).toBe(true);
    expect(isFrequencyAllowed(ENTITLEMENTS.pro, 'any-cron')).toBe(false);
  });

  it('daily (free) allows only daily', () => {
    expect(isFrequencyAllowed(ENTITLEMENTS.free, 'daily')).toBe(true);
    expect(isFrequencyAllowed(ENTITLEMENTS.free, 'hourly')).toBe(false);
    expect(isFrequencyAllowed(ENTITLEMENTS.free, 'continuous')).toBe(false);
    expect(isFrequencyAllowed(ENTITLEMENTS.free, 'any-cron')).toBe(false);
  });
});

describe('plans / minIntervalMinutes', () => {
  it('maps each tier ceiling to its schedule-interval floor', () => {
    expect(minIntervalMinutes(ENTITLEMENTS.free)).toBe(1440);
    expect(minIntervalMinutes(ENTITLEMENTS.pro)).toBe(5);
    expect(minIntervalMinutes(ENTITLEMENTS.business)).toBe(1);
  });
});

describe('plans / feature flags', () => {
  it('gates PITR at Pro+ and mirror at Business', () => {
    expect(ENTITLEMENTS.free.pitrRestore).toBe(false);
    expect(ENTITLEMENTS.pro.pitrRestore).toBe(true);
    expect(ENTITLEMENTS.business.pitrRestore).toBe(true);
    expect(ENTITLEMENTS.free.mirror).toBe(false);
    expect(ENTITLEMENTS.pro.mirror).toBe(false);
    expect(ENTITLEMENTS.business.mirror).toBe(true);
  });
});
