import { describe, expect, it } from 'vitest';
import { pickNearestSnapshot } from './backups.pitr.js';

const snap = (id: string, time: string) => ({ id, short_id: id, time });

describe('pickNearestSnapshot', () => {
  it('returns null for an empty repo', () => {
    expect(pickNearestSnapshot([], new Date('2026-07-01T00:00:00Z'))).toBeNull();
  });

  it('returns null when the target predates every snapshot', () => {
    const records = [snap('a', '2026-07-01T00:00:00Z')];
    expect(pickNearestSnapshot(records, new Date('2026-06-30T23:59:59Z'))).toBeNull();
  });

  it('picks an exact-time hit with a zero gap', () => {
    const records = [snap('a', '2026-07-01T00:00:00Z'), snap('b', '2026-07-02T00:00:00Z')];
    const res = pickNearestSnapshot(records, new Date('2026-07-01T00:00:00Z'));
    expect(res?.snapshot.id).toBe('a');
    expect(res?.gapSeconds).toBe(0);
  });

  it('picks the newest snapshot before the target, regardless of input order', () => {
    const records = [
      snap('newest', '2026-07-03T00:00:00Z'),
      snap('middle', '2026-07-02T00:00:00Z'),
      snap('oldest', '2026-07-01T00:00:00Z'),
    ];
    const res = pickNearestSnapshot(records, new Date('2026-07-02T06:00:00Z'));
    expect(res?.snapshot.id).toBe('middle');
    expect(res?.gapSeconds).toBe(6 * 3600);
  });

  it('skips records with unparseable times instead of trusting them', () => {
    const records = [
      snap('bad', 'not-a-time'),
      snap('good', '2026-07-01T00:00:00Z'),
    ];
    const res = pickNearestSnapshot(records, new Date('2026-07-01T00:00:10Z'));
    expect(res?.snapshot.id).toBe('good');
    expect(res?.gapSeconds).toBe(10);
  });

  it('returns null when only unparseable records exist', () => {
    expect(
      pickNearestSnapshot([snap('bad', 'garbage')], new Date('2026-07-01T00:00:00Z')),
    ).toBeNull();
  });
});
