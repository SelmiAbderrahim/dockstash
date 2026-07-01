import { apiClient } from '@shared/api/client';
import type { Project, ProjectPlan, Schedule } from './types';

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
  jobId: string;
}
interface SchedulesResp {
  schedules: Schedule[];
}
interface ScheduleResp {
  schedule: Schedule;
}

export const listProjectsRequest = () =>
  apiClient<ProjectsListResp>('/backups', { auth: true }).then((r) => r.projects);

export const scanProjectRequest = (path: string) =>
  apiClient<ScanResp>('/backups/scan', { method: 'POST', auth: true, body: { path } }).then(
    (r) => r.plan,
  );

export const createProjectRequest = (input: { name: string; path: string; plan: ProjectPlan }) =>
  apiClient<ProjectResp>('/backups', { method: 'POST', auth: true, body: input }).then(
    (r) => r.project,
  );

export const updatePlanRequest = (projectId: string, plan: ProjectPlan) =>
  apiClient<ProjectResp>(`/backups/${projectId}/plan`, {
    method: 'PATCH',
    auth: true,
    body: { plan },
  }).then((r) => r.project);

export const runBackupNowRequest = (projectId: string) =>
  apiClient<EnqueueResp>('/scheduler/enqueue', {
    method: 'POST',
    auth: true,
    body: { projectId, kind: 'backup' },
  }).then((r) => r.jobId);

export const listSchedulesRequest = () =>
  apiClient<SchedulesResp>('/scheduler/schedules', { auth: true }).then((r) => r.schedules);

export const createScheduleRequest = (input: {
  projectId: string;
  kind: string;
  cron: string;
  enabled?: boolean;
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
