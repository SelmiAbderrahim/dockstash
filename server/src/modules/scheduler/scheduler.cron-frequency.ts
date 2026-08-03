/**
 * Coarse cadence buckets for a 5-field cron expression. Purely descriptive —
 * a self-hosted install imposes no cadence limits, so nothing rejects a
 * schedule based on this. It exists so callers (UI labels, logs, reports) can
 * describe how often a schedule runs without re-parsing cron.
 */
export type ScheduleFrequency = 'daily' | 'hourly' | 'continuous' | 'any-cron';

/**
 * Classify a cron expression into a coarse frequency bucket. Conservative:
 * anything it cannot confidently place falls through to `any-cron`.
 */
export function classifyCron(expr: string): ScheduleFrequency {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return 'any-cron';
  /* c8 ignore next -- a 5-field split always yields a defined [0]; `?? ''` is defensive */
  const minute = parts[0] ?? '';
  /* c8 ignore next -- a 5-field split always yields a defined [1]; `?? ''` is defensive */
  const hour = parts[1] ?? '';
  // Pure minute step (`*/N * * * *`): the continuous near-PITR shape. Steps of
  // 5 minutes or coarser classify as `continuous`; finer steps stay
  // `any-cron`. Anything else non-fixed (lists, ranges, bare `*`) stays
  // conservatively `any-cron`.
  const stepMatch = /^\*\/(\d+)$/.exec(minute);
  if (stepMatch !== null && hour === '*') {
    const step = Number(stepMatch[1]);
    return step >= 5 ? 'continuous' : 'any-cron';
  }
  if (minute === '*' || minute.includes('*/') || minute.includes('-') || minute.includes(',')) {
    return 'any-cron';
  }
  if (hour === '*' || hour.includes('*/') || hour.includes('-') || hour.includes(',')) {
    return 'hourly';
  }
  return 'daily';
}
