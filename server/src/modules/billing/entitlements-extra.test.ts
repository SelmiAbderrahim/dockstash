import { describe, expect, it } from 'vitest';
import { capForClient, classifyCron } from './entitlements.service.js';

describe('entitlements / capForClient', () => {
  it('passes finite caps through and maps the infinite ceiling to null', () => {
    expect(capForClient(1)).toBe(1);
    expect(capForClient(10)).toBe(10);
    expect(capForClient(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('entitlements / classifyCron', () => {
  it('returns any-cron for expressions that are not five fields', () => {
    expect(classifyCron('bad')).toBe('any-cron');
    expect(classifyCron('* * *')).toBe('any-cron');
    expect(classifyCron('0 3 * * * 7')).toBe('any-cron');
  });

  it('classifies five-field expressions by minute/hour specificity', () => {
    expect(classifyCron('0 3 * * *')).toBe('daily');
    expect(classifyCron('30 * * * *')).toBe('hourly');
    expect(classifyCron('0-30 3 * * *')).toBe('any-cron');
    expect(classifyCron('15,45 3 * * *')).toBe('any-cron');
    expect(classifyCron('0 */2 * * *')).toBe('hourly');
    expect(classifyCron('0 1-5 * * *')).toBe('hourly');
    expect(classifyCron('0 8,20 * * *')).toBe('hourly');
  });

  it('classifies pure minute steps >= 5 as continuous (Pro near-PITR tier)', () => {
    expect(classifyCron('*/5 * * * *')).toBe('continuous');
    expect(classifyCron('*/15 * * * *')).toBe('continuous');
    expect(classifyCron('*/30 * * * *')).toBe('continuous');
  });

  it('keeps sub-5-minute steps, bare *, and stepped-hour combos at any-cron', () => {
    expect(classifyCron('*/1 * * * *')).toBe('any-cron');
    expect(classifyCron('*/4 * * * *')).toBe('any-cron');
    expect(classifyCron('* * * * *')).toBe('any-cron');
    // Minute step with a constrained hour is not the continuous shape.
    expect(classifyCron('*/15 2 * * *')).toBe('any-cron');
  });
});
