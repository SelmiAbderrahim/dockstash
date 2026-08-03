import { describe, expect, it } from 'vitest';
import { classifyCron } from './scheduler.cron-frequency.js';

describe('classifyCron', () => {
  it('falls back to any-cron for anything that is not five fields', () => {
    expect(classifyCron('bad')).toBe('any-cron');
    expect(classifyCron('* * *')).toBe('any-cron');
    expect(classifyCron('0 3 * * * 7')).toBe('any-cron');
  });

  it('labels fixed-minute expressions daily or hourly', () => {
    expect(classifyCron('0 3 * * *')).toBe('daily');
    expect(classifyCron('30 * * * *')).toBe('hourly');
    expect(classifyCron('0 */2 * * *')).toBe('hourly');
    expect(classifyCron('0 1-5 * * *')).toBe('hourly');
    expect(classifyCron('0 8,20 * * *')).toBe('hourly');
  });

  it('labels a non-fixed minute field any-cron', () => {
    expect(classifyCron('0-30 3 * * *')).toBe('any-cron');
    expect(classifyCron('15,45 3 * * *')).toBe('any-cron');
    expect(classifyCron('* * * * *')).toBe('any-cron');
  });

  it('labels a whole-hour minute step of 5+ minutes continuous', () => {
    expect(classifyCron('*/5 * * * *')).toBe('continuous');
    expect(classifyCron('*/15 * * * *')).toBe('continuous');
    expect(classifyCron('*/30 * * * *')).toBe('continuous');
  });

  it('keeps sub-5-minute and hour-scoped steps at any-cron', () => {
    expect(classifyCron('*/1 * * * *')).toBe('any-cron');
    expect(classifyCron('*/4 * * * *')).toBe('any-cron');
    expect(classifyCron('*/15 2 * * *')).toBe('any-cron');
  });
});
