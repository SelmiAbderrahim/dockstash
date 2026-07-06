import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as client from '@shared/api/client';
import {
  listProjectsRequest,
  discoverFoldersRequest,
  discoverContainersRequest,
  discoverAgentRequest,
  refreshAgentDiscoveryRequest,
  scanProjectRequest,
  createProjectRequest,
  updatePlanRequest,
  assignProjectAgentRequest,
  runBackupNowRequest,
  listProjectJobsRequest,
  listSchedulesRequest,
  createScheduleRequest,
  updateScheduleRequest,
  resolvePitrRequest,
  pitrRestoreRequest,
  updateAlertsRequest,
  updateMirrorRequest,
} from './api';
import type { ProjectPlan } from './types';

vi.mock('@shared/api/client', () => ({ apiClient: vi.fn() }));
const apiClient = vi.mocked(client.apiClient);

const plan: ProjectPlan = { paths: ['/a'], databases: [], configs: [] };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('projects api wrappers', () => {
  it('listProjectsRequest GETs /backups and unwraps projects', async () => {
    apiClient.mockResolvedValue({ projects: [{ id: 'p1' }] } as never);
    const result = await listProjectsRequest();
    expect(apiClient).toHaveBeenCalledWith('/backups', { auth: true });
    expect(result).toEqual([{ id: 'p1' }]);
  });

  it('discoverFoldersRequest GETs /backups/discover/folders and unwraps folders', async () => {
    apiClient.mockResolvedValue({ folders: [{ name: 'app' }] } as never);
    const result = await discoverFoldersRequest();
    expect(apiClient).toHaveBeenCalledWith('/backups/discover/folders', { auth: true });
    expect(result).toEqual([{ name: 'app' }]);
  });

  it('discoverContainersRequest GETs /backups/discover/containers and returns the result', async () => {
    const payload = { containers: [{ project: 'shop' }], dockerAvailable: true };
    apiClient.mockResolvedValue(payload as never);
    const result = await discoverContainersRequest();
    expect(apiClient).toHaveBeenCalledWith('/backups/discover/containers', { auth: true });
    expect(result).toEqual(payload);
  });

  it('discoverAgentRequest GETs the agent discovery snapshot', async () => {
    const payload = {
      folders: [],
      containers: [],
      dockerAvailable: false,
      snapshotAt: null,
      reported: false,
      errors: [],
    };
    apiClient.mockResolvedValue(payload as never);
    const result = await discoverAgentRequest('a1');
    expect(apiClient).toHaveBeenCalledWith('/agents/a1/discovery', { auth: true });
    expect(result).toEqual(payload);
  });

  it('refreshAgentDiscoveryRequest POSTs to the refresh endpoint', async () => {
    apiClient.mockResolvedValue(undefined as never);
    await refreshAgentDiscoveryRequest('a1');
    expect(apiClient).toHaveBeenCalledWith('/agents/a1/discovery/refresh', {
      method: 'POST',
      auth: true,
    });
  });

  it('scanProjectRequest POSTs the path and unwraps plan', async () => {
    apiClient.mockResolvedValue({ plan } as never);
    const result = await scanProjectRequest('/var/www/app');
    expect(apiClient).toHaveBeenCalledWith('/backups/scan', {
      method: 'POST',
      auth: true,
      body: { path: '/var/www/app' },
    });
    expect(result).toBe(plan);
  });

  it('createProjectRequest POSTs the input and unwraps project', async () => {
    apiClient.mockResolvedValue({ project: { id: 'p2' } } as never);
    const input = {
      name: 'app',
      path: '/var/www/app',
      repoPassword: 'password1',
      plan,
      agentId: 'a1',
    };
    const result = await createProjectRequest(input);
    expect(apiClient).toHaveBeenCalledWith('/backups', { method: 'POST', auth: true, body: input });
    expect(result).toEqual({ id: 'p2' });
  });

  it('updatePlanRequest PATCHes the plan path and unwraps project', async () => {
    apiClient.mockResolvedValue({ project: { id: 'p3' } } as never);
    const result = await updatePlanRequest('p3', plan);
    expect(apiClient).toHaveBeenCalledWith('/backups/p3/plan', {
      method: 'PATCH',
      auth: true,
      body: { plan },
    });
    expect(result).toEqual({ id: 'p3' });
  });

  it('assignProjectAgentRequest PATCHes the agent path and unwraps project', async () => {
    apiClient.mockResolvedValue({ project: { id: 'p1', agentId: 'a1' } } as never);
    const result = await assignProjectAgentRequest('p1', 'a1');
    expect(apiClient).toHaveBeenCalledWith('/backups/p1/agent', {
      method: 'PATCH',
      auth: true,
      body: { agentId: 'a1' },
    });
    expect(result).toEqual({ id: 'p1', agentId: 'a1' });
  });

  it('assignProjectAgentRequest sends null to unassign back to local', async () => {
    apiClient.mockResolvedValue({ project: { id: 'p1', agentId: null } } as never);
    const result = await assignProjectAgentRequest('p1', null);
    expect(apiClient).toHaveBeenCalledWith('/backups/p1/agent', {
      method: 'PATCH',
      auth: true,
      body: { agentId: null },
    });
    expect(result).toEqual({ id: 'p1', agentId: null });
  });

  it('runBackupNowRequest enqueues a backup job and unwraps jobId', async () => {
    apiClient.mockResolvedValue({ job: { id: 'j-1', kind: 'backup' } } as never);
    const result = await runBackupNowRequest('p1');
    expect(apiClient).toHaveBeenCalledWith('/scheduler/enqueue', {
      method: 'POST',
      auth: true,
      body: { projectId: 'p1', kind: 'backup' },
    });
    expect(result).toBe('j-1');
  });

  it('listSchedulesRequest GETs schedules and unwraps them', async () => {
    apiClient.mockResolvedValue({ schedules: [{ id: 's1' }] } as never);
    const result = await listSchedulesRequest();
    expect(apiClient).toHaveBeenCalledWith('/scheduler/schedules', { auth: true });
    expect(result).toEqual([{ id: 's1' }]);
  });

  it('createScheduleRequest POSTs the input and unwraps schedule', async () => {
    apiClient.mockResolvedValue({ schedule: { id: 's2' } } as never);
    const input = { projectId: 'p1', kind: 'backup', cron: '0 3 * * *', enabled: true };
    const result = await createScheduleRequest(input);
    expect(apiClient).toHaveBeenCalledWith('/scheduler/schedules', {
      method: 'POST',
      auth: true,
      body: input,
    });
    expect(result).toEqual({ id: 's2' });
  });

  it('updateScheduleRequest PATCHes the schedule path and unwraps schedule', async () => {
    apiClient.mockResolvedValue({ schedule: { id: 's3' } } as never);
    const patch = { cron: '0 4 * * *', enabled: false };
    const result = await updateScheduleRequest('s3', patch);
    expect(apiClient).toHaveBeenCalledWith('/scheduler/schedules/s3', {
      method: 'PATCH',
      auth: true,
      body: patch,
    });
    expect(result).toEqual({ id: 's3' });
  });

  it('createScheduleRequest passes the continuous preset through in the body', async () => {
    apiClient.mockResolvedValue({ schedule: { id: 's4' } } as never);
    const input = {
      projectId: 'p1',
      kind: 'backup',
      cron: '*/5 * * * *',
      preset: 'continuous' as const,
    };
    const result = await createScheduleRequest(input);
    expect(apiClient).toHaveBeenCalledWith('/scheduler/schedules', {
      method: 'POST',
      auth: true,
      body: input,
    });
    expect(result).toEqual({ id: 's4' });
  });

  it('resolvePitrRequest GETs the pitr endpoint with the encoded timestamp', async () => {
    const payload = {
      target: '2026-07-01T10:00:00.000Z',
      gapSeconds: 120,
      snapshot: { id: 'snap1', time: '2026-07-01T09:58:00.000Z' },
    };
    apiClient.mockResolvedValue(payload as never);
    const result = await resolvePitrRequest('p1', '2026-07-01T10:00:00.000Z');
    expect(apiClient).toHaveBeenCalledWith(
      '/backups/p1/pitr?ts=2026-07-01T10%3A00%3A00.000Z',
      { auth: true },
    );
    expect(result).toEqual(payload);
  });

  it('pitrRestoreRequest enqueues a restore job and unwraps the job id', async () => {
    apiClient.mockResolvedValue({ job: { id: 'j-9', kind: 'restore' } } as never);
    const result = await pitrRestoreRequest({
      projectId: 'p1',
      snapshotId: 'snap1',
      overwrite: false,
      targetPath: '/restore/here',
    });
    expect(apiClient).toHaveBeenCalledWith('/scheduler/enqueue', {
      method: 'POST',
      auth: true,
      body: {
        projectId: 'p1',
        kind: 'restore',
        snapshotId: 'snap1',
        overwrite: false,
        targetPath: '/restore/here',
      },
    });
    expect(result).toBe('j-9');
  });

  it('pitrRestoreRequest omits targetPath when overwriting in place', async () => {
    apiClient.mockResolvedValue({ job: { id: 'j-10', kind: 'restore' } } as never);
    const result = await pitrRestoreRequest({ projectId: 'p1', snapshotId: 'snap1', overwrite: true });
    expect(apiClient).toHaveBeenCalledWith('/scheduler/enqueue', {
      method: 'POST',
      auth: true,
      body: {
        projectId: 'p1',
        kind: 'restore',
        snapshotId: 'snap1',
        overwrite: true,
        targetPath: undefined,
      },
    });
    expect(result).toBe('j-10');
  });

  it('updateAlertsRequest PATCHes the alerts path and unwraps project', async () => {
    apiClient.mockResolvedValue({ project: { id: 'p1', alertWebhookUrl: 'https://x' } } as never);
    const result = await updateAlertsRequest('p1', 'https://x');
    expect(apiClient).toHaveBeenCalledWith('/backups/p1/alerts', {
      method: 'PATCH',
      auth: true,
      body: { webhookUrl: 'https://x' },
    });
    expect(result).toEqual({ id: 'p1', alertWebhookUrl: 'https://x' });
  });

  it('listProjectJobsRequest GETs /agents/jobs and unwraps jobs', async () => {
    apiClient.mockResolvedValue({ jobs: [{ id: 'j1' }] } as never);
    const result = await listProjectJobsRequest('p1');
    expect(apiClient).toHaveBeenCalledWith('/agents/jobs?projectId=p1', { auth: true });
    expect(result).toEqual([{ id: 'j1' }]);
  });

  it('updateMirrorRequest PATCHes the mirror path and unwraps project', async () => {
    const mirror = { enabled: true, sourcePath: '/src', targetPath: '/dst' };
    apiClient.mockResolvedValue({ project: { id: 'p1', mirror } } as never);
    const result = await updateMirrorRequest('p1', mirror);
    expect(apiClient).toHaveBeenCalledWith('/backups/p1/mirror', {
      method: 'PATCH',
      auth: true,
      body: mirror,
    });
    expect(result).toEqual({ id: 'p1', mirror });
  });
});
