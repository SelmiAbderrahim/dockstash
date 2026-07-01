import { describe, expect, it } from 'vitest';
import * as marketing from './index';

describe('marketing public API barrel', () => {
  it('re-exports the marketing routes', () => {
    expect(Array.isArray(marketing.marketingRoutes)).toBe(true);
    expect(marketing.marketingRoutes.length).toBeGreaterThan(0);
  });
});
