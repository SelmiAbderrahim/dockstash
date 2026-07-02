import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as client from '@shared/api/client';
import {
  listProjectsRequest,
  scanProjectRequest,
  createProjectRequest,
  updatePlanRequest,
  runBackupNowRequest,
  listSchedulesRequest,
  createScheduleRequest,
  updateScheduleRequest,
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
    const input = { name: 'app', path: '/var/www/app', plan };
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
});
