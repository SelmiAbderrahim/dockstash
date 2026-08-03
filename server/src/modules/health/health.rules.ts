/**
 * Pure health-scoring rules for the backup-health dashboard. No I/O — the
 * service layer collects the signals, this module turns them into a verdict.
 * Status language mirrors the design system (SPEC-A1):
 *   healthy  → success token; degraded → warning token; critical → destructive.
 */

export const HEALTH_STATUSES = ['healthy', 'degraded', 'critical'] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

export interface ProjectHealthSignals {
  /** `lastStatus` on the project ('idle' | 'running' | 'success' | 'failed'). */
  lastStatus: string;
  lastSuccessAt: Date | null;
  lastCheckStatus: string | null;
  lastDrillStatus: string | null;
  lastRestoreStatus: string | null;
  /** Whether at least one enabled schedule exists for the project. */
  hasEnabledSchedule: boolean;
  /** Assigned fleet agent status; null when the project runs locally. */
  agentStatus: 'online' | 'offline' | null;
  /** Heartbeat threshold in hours (env.ALERT_HEARTBEAT_HOURS). */
  staleAfterHours: number;
  now: Date;
}

export interface ProjectHealthVerdict {
  status: HealthStatus;
  /** Machine-readable reasons; the client localizes them. */
  reasons: string[];
}

const HOUR_MS = 60 * 60 * 1000;

export function computeProjectHealth(
  signals: ProjectHealthSignals,
): ProjectHealthVerdict {
  const critical: string[] = [];
  const degraded: string[] = [];

  if (signals.lastStatus === 'failed') critical.push('backupFailed');
  if (signals.lastDrillStatus === 'failed') critical.push('drillFailed');
  if (signals.lastRestoreStatus === 'failed') critical.push('restoreFailed');
  if (signals.agentStatus === 'offline') critical.push('agentOffline');

  const stale =
    signals.lastSuccessAt === null ||
    signals.now.getTime() - signals.lastSuccessAt.getTime() >
      signals.staleAfterHours * HOUR_MS;
  if (stale) {
    if (signals.lastSuccessAt === null) degraded.push('neverBackedUp');
    else critical.push('backupStale');
  }

  if (signals.lastCheckStatus === 'failed') degraded.push('checkFailed');
  if (!signals.hasEnabledSchedule) degraded.push('noSchedule');

  if (critical.length > 0) {
    return { status: 'critical', reasons: [...critical, ...degraded] };
  }
  if (degraded.length > 0) {
    return { status: 'degraded', reasons: degraded };
  }
  return { status: 'healthy', reasons: [] };
}

/** Aggregate the fleet-wide banner status: worst project wins. */
export function worstStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes('critical')) return 'critical';
  if (statuses.includes('degraded')) return 'degraded';
  return 'healthy';
}
