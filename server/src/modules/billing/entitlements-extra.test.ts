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
    expect(classifyCron('*/5 * * * *')).toBe('any-cron');
    expect(classifyCron('0-30 3 * * *')).toBe('any-cron');
    expect(classifyCron('15,45 3 * * *')).toBe('any-cron');
    expect(classifyCron('0 */2 * * *')).toBe('hourly');
    expect(classifyCron('0 1-5 * * *')).toBe('hourly');
    expect(classifyCron('0 8,20 * * *')).toBe('hourly');
  });
});
