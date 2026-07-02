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

/** The `apiKey` is returned ONCE at registration and never retrievable again. */
export interface RegisterAgentResult {
  agent: Agent;
  apiKey: string;
}

export type FleetLockedReason = 'multiVpsLocked';
