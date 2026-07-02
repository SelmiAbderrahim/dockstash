export type AgentStatus = 'online' | 'offline';

export interface Agent {
  id: string;
  name: string;
  host: string;
  port: number;
  status: AgentStatus;
  lastSeenAt: string | null;
}

export interface FleetEntry {
  id: string;
  name: string;
  host: string;
  status: AgentStatus;
  lastSeenAt: string | null;
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
