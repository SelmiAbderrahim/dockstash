export type LastStatus = 'idle' | 'running' | 'success' | 'failed';
export type PassFail = 'pass' | 'fail' | null;

export interface ProjectPlan {
  paths: string[];
  databases: Array<{ service: string; type: string; container: string; enabled: boolean }>;
  configs: string[];
}

export interface Project {
  id: string;
  owner: string;
  name: string;
  path: string;
  /** Fleet agent this project runs on; null = the local/default server. */
  agentId: string | null;
  plan: ProjectPlan;
  lastStatus: LastStatus | string;
  lastError: string;
  lastRunAt: string | null;
  lastCheckAt: string | null;
  lastCheckStatus: PassFail;
  lastCheckDetail: string;
  lastDrillAt: string | null;
  lastDrillStatus: PassFail;
  lastDrillDetail: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveredFolder {
  name: string;
  path: string;
  hasCompose: boolean;
  composeFile: string | null;
}

export interface DiscoveredContainerGroup {
  project: string;
  workingDir: string | null;
  configFiles: string[];
  services: string[];
  containerNames: string[];
  addable: boolean;
  standalone: boolean;
}

export interface DiscoverContainersResult {
  containers: DiscoveredContainerGroup[];
  dockerAvailable: boolean;
}

/** A fleet agent's discovered folder, carrying a ready backup plan. */
export interface AgentFolder extends DiscoveredFolder {
  plan: ProjectPlan;
}

/** A fleet agent's Compose group; `plan` derived from its live containers. */
export interface AgentContainerGroup extends DiscoveredContainerGroup {
  plan: ProjectPlan | null;
}

export interface AgentDiscoveryView {
  folders: AgentFolder[];
  containers: AgentContainerGroup[];
  dockerAvailable: boolean;
  /** The directories this agent scans (its DOCKSTASH_PROJECT_ROOTS allowlist). */
  roots: string[];
  snapshotAt: string | null;
  /** True once the agent has ever sent a heartbeat; false means "never reported". */
  reported: boolean;
  /** Reasons the snapshot came back empty/degraded (e.g. unreadable root, Docker unreachable). */
  errors: string[];
}

export interface Schedule {
  id: string;
  projectId: string;
  kind: string;
  cron: string;
  enabled: boolean;
  retention: { keepDaily: number; keepWeekly: number; keepMonthly: number };
  createdAt: string;
  updatedAt: string;
}
