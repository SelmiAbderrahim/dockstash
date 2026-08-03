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
  /** Webhook POSTed on backup failure; empty string = alerts disabled. */
  alertWebhookUrl: string;
  /** Secondary-location mirror settings for this project's repository. */
  mirror: { enabled: boolean; sourcePath: string; targetPath: string };
  lastStatus: LastStatus | string;
  lastError: string;
  lastRunAt: string | null;
  lastCheckAt: string | null;
  lastCheckStatus: PassFail;
  lastCheckDetail: string;
  lastDrillAt: string | null;
  lastDrillStatus: PassFail;
  lastDrillDetail: string;
  lastRestoreAt: string | null;
  lastRestoreStatus: PassFail;
  lastRestoreDetail: string;
  createdAt: string;
  updatedAt: string;
}

/** One persisted fleet-agent job, as served by GET /api/agents/jobs. */
export interface ProjectJob {
  id: string;
  kind: 'backup' | 'check' | 'prune' | 'restore';
  status: 'pending' | 'leased' | 'succeeded' | 'failed';
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string;
  restore: { snapshotId: string; overwrite: boolean; targetPath: string | null } | null;
  logTail: string[];
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
  retention: {
    keepDaily: number;
    keepWeekly: number;
    keepMonthly: number;
    keepHourly: number;
    keepLast: number;
  };
  createdAt: string;
  updatedAt: string;
}

/** Result of resolving a point-in-time to the closest snapshot at or before it. */
export interface PitrResolution {
  target: string;
  gapSeconds: number;
  snapshot: { id: string; time: string };
}
