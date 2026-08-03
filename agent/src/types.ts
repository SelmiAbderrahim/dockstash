/**
 * Wire types for the Dockstash `/api/agent` machine surface. Mirror of the
 * server's claim payload (server/src/modules/agents/agent-jobs.service.ts) —
 * keep in sync manually.
 */

/**
 * Runtime marker so this otherwise types-only module carries one executable
 * export — keeps the v8 all-files scan from emitting a permanent 0% stub
 * (mirrors the server's boundary-module `*_VERSION` convention).
 */
export const AGENT_WIRE_VERSION = 1;

export type AgentJobKind = 'backup' | 'check' | 'prune' | 'restore';

export interface ClaimedJob {
  id: string;
  kind: AgentJobKind;
  projectId: string;
  leaseSeconds: number;
  attempt: number;
  maxAttempts: number;
  plan: {
    paths: string[];
    configs: string[];
    databases: Array<{
      service: string;
      type: string;
      container: string;
      enabled: boolean;
    }>;
  };
  retention: { keepDaily: number; keepWeekly: number; keepMonthly: number } | null;
  restore: { snapshotId: string; overwrite: boolean; targetPath: string | null } | null;
  repo: { url: string; password: string };
  ssh: { privateKey: string; hostKeyLine: string };
}

export interface HeartbeatResponse {
  agent: { id: string; name: string; status: 'online' | 'offline' };
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
  /** Set once when an operator requested a fresh discovery snapshot (see /discovery/refresh). */
  refreshDiscovery?: boolean;
  /** The agent version the server expects — used to warn the operator when this daemon is stale. */
  latestVersion?: string;
}

export interface JobResultStats {
  snapshotCount?: number;
  totalRepoBytes?: number;
  lastBackupBytes?: number;
}

export interface JobResult {
  ok: boolean;
  error?: string;
  stats?: JobResultStats;
}
