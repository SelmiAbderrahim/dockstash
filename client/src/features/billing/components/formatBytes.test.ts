import { describe, expect, it } from 'vitest';
import { formatBytes } from './BillingPage';

describe('formatBytes (per-project metering)', () => {
  it('renders 0 and negatives as "0 B"', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-5)).toBe('0 B');
  });

  it('renders whole bytes without decimals', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('scales to KB/MB/GB/TB with one decimal', () => {
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.0 GB');
    expect(formatBytes(2 * 1024 ** 4)).toBe('2.0 TB');
  });

  it('clamps beyond TB to TB', () => {
    expect(formatBytes(1024 ** 6)).toContain('TB');
  });
});
