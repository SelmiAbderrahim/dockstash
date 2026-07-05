import type { ResticSnapshotDetail } from './backups.restic-runner.js';

export interface PitrResolution {
  snapshot: ResticSnapshotDetail;
  /** Seconds between the requested point-in-time and the chosen snapshot. */
  gapSeconds: number;
}

/**
 * Point-in-time resolver: pick the newest snapshot taken at or before the
 * requested timestamp. Pure — the controller supplies the records (from
 * `restic snapshots --json`) and the target instant.
 *
 * Returns null when no snapshot predates the target (repo empty, or the
 * target is earlier than the first snapshot) — the caller maps that to 404.
 * Records with unparseable times are skipped rather than trusted.
 */
export function pickNearestSnapshot(
  records: ResticSnapshotDetail[],
  target: Date,
): PitrResolution | null {
  let best: ResticSnapshotDetail | null = null;
  let bestMs = Number.NEGATIVE_INFINITY;
  for (const record of records) {
    const ms = Date.parse(record.time);
    if (Number.isNaN(ms)) continue;
    if (ms <= target.getTime() && ms > bestMs) {
      best = record;
      bestMs = ms;
    }
  }
  if (!best) return null;
  return {
    snapshot: best,
    gapSeconds: Math.round((target.getTime() - bestMs) / 1000),
  };
}
