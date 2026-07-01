import { afterEach, describe, expect, it } from 'vitest';
import { env } from '../../config/env.js';
import {
  getIntervalForProductId,
  getPlanForProductId,
  getProductIdForPlan,
  PLAN_TO_PRODUCT,
} from './polar-config.js';

type EnvMutable = Record<string, string | undefined>;

const KEYS = [
  'POLAR_PRO_PRODUCT_ID',
  'POLAR_BUSINESS_PRODUCT_ID',
  'POLAR_PRO_YEARLY_PRODUCT_ID',
  'POLAR_BUSINESS_YEARLY_PRODUCT_ID',
] as const;

function withProducts(fn: () => void): void {
  const prev: Record<string, string | undefined> = {};
  for (const k of KEYS) prev[k] = (env as unknown as EnvMutable)[k];
  (env as unknown as EnvMutable).POLAR_PRO_PRODUCT_ID = 'prod_pro';
  (env as unknown as EnvMutable).POLAR_BUSINESS_PRODUCT_ID = 'prod_biz';
  (env as unknown as EnvMutable).POLAR_PRO_YEARLY_PRODUCT_ID = 'prod_pro_y';
  (env as unknown as EnvMutable).POLAR_BUSINESS_YEARLY_PRODUCT_ID = 'prod_biz_y';
  try {
    fn();
  } finally {
    for (const k of KEYS) (env as unknown as EnvMutable)[k] = prev[k];
  }
}

describe('polar-config / plan ↔ product mapping', () => {
  it('getPlanForProductId resolves base + yearly ids and defaults to free', () => {
    withProducts(() => {
      expect(getPlanForProductId('prod_pro')).toBe('pro');
      expect(getPlanForProductId('prod_biz')).toBe('business');
      expect(getPlanForProductId('prod_pro_y')).toBe('pro');
      expect(getPlanForProductId('prod_biz_y')).toBe('business');
      expect(getPlanForProductId('unknown')).toBe('free');
      expect(getPlanForProductId(undefined)).toBe('free');
      expect(getPlanForProductId(null)).toBe('free');
    });
  });

  it('getIntervalForProductId returns month/year and defaults to month', () => {
    withProducts(() => {
      expect(getIntervalForProductId('prod_pro')).toBe('month');
      expect(getIntervalForProductId('prod_biz')).toBe('month');
      expect(getIntervalForProductId('prod_pro_y')).toBe('year');
      expect(getIntervalForProductId('prod_biz_y')).toBe('year');
      expect(getIntervalForProductId('unknown')).toBe('month');
      expect(getIntervalForProductId(null)).toBe('month');
    });
  });

  it('getProductIdForPlan resolves the id for a slug + interval', () => {
    withProducts(() => {
      expect(getProductIdForPlan('pro')).toBe('prod_pro');
      expect(getProductIdForPlan('pro', 'month')).toBe('prod_pro');
      expect(getProductIdForPlan('pro', 'year')).toBe('prod_pro_y');
      expect(getProductIdForPlan('business', 'year')).toBe('prod_biz_y');
      // free has no envKey → always null.
      expect(getProductIdForPlan('free')).toBeNull();
    });
  });

  it('getProductIdForPlan returns null when the env id is unset', () => {
    const prev = (env as unknown as EnvMutable).POLAR_PRO_PRODUCT_ID;
    (env as unknown as EnvMutable).POLAR_PRO_PRODUCT_ID = undefined;
    try {
      expect(getProductIdForPlan('pro')).toBeNull();
    } finally {
      (env as unknown as EnvMutable).POLAR_PRO_PRODUCT_ID = prev;
    }
  });
});

describe('polar-config / PLAN_TO_PRODUCT proxy', () => {
  afterEach(() => {
    // no-op; withProducts restores env itself
  });

  it('reads the current env at access time', () => {
    withProducts(() => {
      expect(PLAN_TO_PRODUCT.pro).toBe('prod_pro');
      expect(PLAN_TO_PRODUCT.business).toBe('prod_biz');
      expect(PLAN_TO_PRODUCT.pro_yearly).toBe('prod_pro_y');
      expect(PLAN_TO_PRODUCT.business_yearly).toBe('prod_biz_y');
      // free key exists but has no envKey → null.
      expect(PLAN_TO_PRODUCT.free).toBeNull();
    });
  });

  it('returns undefined for unknown string keys and symbol keys', () => {
    const asRecord = PLAN_TO_PRODUCT as unknown as Record<string, string | null>;
    expect(asRecord.nope).toBeUndefined();
    const sym = Symbol('x');
    expect((PLAN_TO_PRODUCT as unknown as Record<symbol, unknown>)[sym]).toBeUndefined();
  });

  it('enumerates the plan keys via ownKeys', () => {
    expect(Object.keys(PLAN_TO_PRODUCT).sort()).toEqual(
      ['business', 'business_yearly', 'free', 'pro', 'pro_yearly'].sort(),
    );
  });

  it('exposes property descriptors for known keys only', () => {
    withProducts(() => {
      const desc = Object.getOwnPropertyDescriptor(PLAN_TO_PRODUCT, 'pro');
      expect(desc).toMatchObject({ enumerable: true, configurable: true, value: 'prod_pro' });
    });
    expect(Object.getOwnPropertyDescriptor(PLAN_TO_PRODUCT, 'missing')).toBeUndefined();
    const sym = Symbol('y');
    expect(
      Object.getOwnPropertyDescriptor(PLAN_TO_PRODUCT as unknown as object, sym),
    ).toBeUndefined();
  });
});
