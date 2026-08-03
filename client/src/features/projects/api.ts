import { apiClient } from '@shared/api/client';
import type {
  AgentDiscoveryView,
  DiscoverContainersResult,
  DiscoveredFolder,
  PitrResolution,
  Project,
  ProjectJob,
  ProjectPlan,
  Schedule,
} from './types';

interface ProjectsListResp {
  projects: Project[];
}
interface ProjectResp {
  project: Project;
}
interface ScanResp {
  plan: ProjectPlan;
}
interface EnqueueResp {
  job: { id: string; kind: string };
}
interface SchedulesResp {
  schedules: Schedule[];
}
interface ScheduleResp {
  schedule: Schedule;
}

export const listProjectsRequest = () =>
  apiClient<ProjectsListResp>('/backups', { auth: true }).then((r) => r.projects);

interface FoldersResp {
  folders: DiscoveredFolder[];
}

export const discoverFoldersRequest = () =>
  apiClient<FoldersResp>('/backups/discover/folders', { auth: true }).then((r) => r.folders);

export const discoverContainersRequest = () =>
  apiClient<DiscoverContainersResult>('/backups/discover/containers', { auth: true });

export const discoverAgentRequest = (agentId: string) =>
  apiClient<AgentDiscoveryView>(`/agents/${agentId}/discovery`, { auth: true });

export const refreshAgentDiscoveryRequest = (agentId: string) =>
  apiClient<void>(`/agents/${agentId}/discovery/refresh`, { method: 'POST', auth: true });

export const scanProjectRequest = (path: string) =>
  apiClient<ScanResp>('/backups/scan', { method: 'POST', auth: true, body: { path } }).then(
    (r) => r.plan,
  );

export const createProjectRequest = (input: {
  name: string;
  path: string;
  repoPassword: string;
  plan: ProjectPlan;
  agentId?: string | null;
}) =>
  apiClient<ProjectResp>('/backups', { method: 'POST', auth: true, body: input }).then(
    (r) => r.project,
  );

export const updatePlanRequest = (projectId: string, plan: ProjectPlan) =>
  apiClient<ProjectResp>(`/backups/${projectId}/plan`, {
    method: 'PATCH',
    auth: true,
    body: { plan },
  }).then((r) => r.project);

export const assignProjectAgentRequest = (projectId: string, agentId: string | null) =>
  apiClient<ProjectResp>(`/backups/${projectId}/agent`, {
    method: 'PATCH',
    auth: true,
    body: { agentId },
  }).then((r) => r.project);

export const runBackupNowRequest = (projectId: string) =>
  apiClient<EnqueueResp>('/scheduler/enqueue', {
    method: 'POST',
    auth: true,
    body: { projectId, kind: 'backup' },
  }).then((r) => r.job.id);

export const runDrillNowRequest = (projectId: string) =>
  apiClient<EnqueueResp>('/scheduler/enqueue', {
    method: 'POST',
    auth: true,
    body: { projectId, kind: 'drill' },
  }).then((r) => r.job.id);

export const runCheckNowRequest = (projectId: string) =>
  apiClient<EnqueueResp>('/scheduler/enqueue', {
    method: 'POST',
    auth: true,
    body: { projectId, kind: 'check' },
  }).then((r) => r.job.id);

export const runMirrorNowRequest = (projectId: string) =>
  apiClient<EnqueueResp>('/scheduler/enqueue', {
    method: 'POST',
    auth: true,
    body: { projectId, kind: 'mirror' },
  }).then((r) => r.job.id);

export const listSchedulesRequest = () =>
  apiClient<SchedulesResp>('/scheduler/schedules', { auth: true }).then((r) => r.schedules);

export const createScheduleRequest = (input: {
  projectId: string;
  kind: string;
  cron: string;
  enabled?: boolean;
  preset?: 'continuous';
}) =>
  apiClient<ScheduleResp>('/scheduler/schedules', {
    method: 'POST',
    auth: true,
    body: input,
  }).then((r) => r.schedule);

export const updateScheduleRequest = (scheduleId: string, patch: { cron?: string; enabled?: boolean }) =>
  apiClient<ScheduleResp>(`/scheduler/schedules/${scheduleId}`, {
    method: 'PATCH',
    auth: true,
    body: patch,
  }).then((r) => r.schedule);

export const resolvePitrRequest = (projectId: string, tsIso: string) =>
  apiClient<PitrResolution>(`/backups/${projectId}/pitr?ts=${encodeURIComponent(tsIso)}`, {
    auth: true,
  });

export const pitrRestoreRequest = (input: {
  projectId: string;
  snapshotId: string;
  overwrite: boolean;
  targetPath?: string;
}) =>
  apiClient<EnqueueResp>('/scheduler/enqueue', {
    method: 'POST',
    auth: true,
    body: {
      projectId: input.projectId,
      kind: 'restore',
      snapshotId: input.snapshotId,
      overwrite: input.overwrite,
      targetPath: input.targetPath,
    },
  }).then((r) => r.job.id);

interface ProjectJobsResp {
  jobs: ProjectJob[];
}

export const listProjectJobsRequest = (projectId: string) =>
  apiClient<ProjectJobsResp>(`/agents/jobs?projectId=${encodeURIComponent(projectId)}`, {
    auth: true,
  }).then((r) => r.jobs);

export const updateAlertsRequest = (projectId: string, webhookUrl: string) =>
  apiClient<ProjectResp>(`/backups/${projectId}/alerts`, {
    method: 'PATCH',
    auth: true,
    body: { webhookUrl },
  }).then((r) => r.project);

export const updateMirrorRequest = (
  projectId: string,
  mirror: { enabled: boolean; sourcePath: string; targetPath: string },
) =>
  apiClient<ProjectResp>(`/backups/${projectId}/mirror`, {
    method: 'PATCH',
    auth: true,
    body: mirror,
  }).then((r) => r.project);
