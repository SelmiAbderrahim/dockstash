export type AgentStatus = 'online' | 'offline';

export interface Agent {
  id: string;
  name: string;
  host: string;
  port: number;
  status: AgentStatus;
  lastSeenAt: string | null;
  /** Daemon self-reported version; '' until the first heartbeat. */
  agentVersion: string;
  /** True when the daemon runs an older version than the published image. */
  outdated: boolean;
}

export interface FleetEntry {
  id: string;
  name: string;
  host: string;
  status: AgentStatus;
  lastSeenAt: string | null;
  agentVersion: string;
  outdated: boolean;
  projectCount: number;
  totalBytes: number;
  snapshotCount: number;
}

export interface RegisterAgentInput {
  name: string;
  host: string;
  port?: number;
}

/**
 * The composite `token` (`dsa_<agentId>.<secret>`) is returned ONCE at
 * registration / rotation and never retrievable again.
 */
export interface RegisterAgentResult {
  agent: Agent;
  token: string;
}

export type FleetLockedReason = 'multiVpsLocked';
