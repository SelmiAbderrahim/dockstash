export type HealthStatus = 'healthy' | 'degraded' | 'critical';

export interface ProjectHealthEntry {
  projectId: string;
  name: string;
  paused: boolean;
  status: HealthStatus;
  reasons: string[];
  lastStatus: string;
  lastSuccessAt: string | null;
  lastDrillStatus: string | null;
  lastCheckStatus: string | null;
  agentStatus: 'online' | 'offline' | null;
  hasEnabledSchedule: boolean;
}

export interface HealthOverview {
  status: HealthStatus;
  projects: ProjectHealthEntry[];
  unreadAlerts: number;
}

export interface AlertItem {
  id: string;
  projectId: string;
  projectName: string;
  kind: 'backup' | 'restore' | 'drill' | 'mirror' | 'heartbeat';
  severity: 'warning' | 'critical';
  error: string;
  read: boolean;
  createdAt: string;
}
