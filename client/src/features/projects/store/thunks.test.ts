import { describe, expect, it, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { projectsReducer } from './slice';
import {
  fetchProjects,
  savePlan,
  assignProjectAgent,
  runBackupNow,
  fetchSchedules,
  saveSchedule,
} from './thunks';
import type { Project, ProjectPlan, Schedule } from '../types';
import * as api from '../api';

vi.mock('../api', () => ({
  listProjectsRequest: vi.fn(),
  scanProjectRequest: vi.fn(),
  createProjectRequest: vi.fn(),
  updatePlanRequest: vi.fn(),
  assignProjectAgentRequest: vi.fn(),
  runBackupNowRequest: vi.fn(),
  listSchedulesRequest: vi.fn(),
  createScheduleRequest: vi.fn(),
  updateScheduleRequest: vi.fn(),
}));

const mocked = vi.mocked(api);
const makeStore = () => configureStore({ reducer: { projects: projectsReducer } });

const plan: ProjectPlan = { paths: ['/a'], databases: [], configs: [] };
const project = { id: 'p1', name: 'app', plan } as unknown as Project;
const schedule = { id: 's1', projectId: 'p1', cron: '0 3 * * *', enabled: true } as unknown as Schedule;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('projects thunks', () => {
  it('fetchProjects resolves the project list', async () => {
    mocked.listProjectsRequest.mockResolvedValue([project]);
    const result = await makeStore().dispatch(fetchProjects());
    expect(fetchProjects.fulfilled.match(result)).toBe(true);
    expect(result.payload).toEqual([project]);
  });

  it('fetchProjects rejects with a message on failure', async () => {
    mocked.listProjectsRequest.mockRejectedValue(new Error('nope'));
    const result = await makeStore().dispatch(fetchProjects());
    expect(fetchProjects.rejected.match(result)).toBe(true);
    expect(result.payload).toBe('nope');
  });

  it('savePlan resolves the updated project', async () => {
    mocked.updatePlanRequest.mockResolvedValue(project);
    const result = await makeStore().dispatch(savePlan({ projectId: 'p1', plan }));
    expect(savePlan.fulfilled.match(result)).toBe(true);
    expect(mocked.updatePlanRequest).toHaveBeenCalledWith('p1', plan);
    expect(result.payload).toEqual(project);
  });

  it('savePlan rejects with a message on failure', async () => {
    mocked.updatePlanRequest.mockRejectedValue(new Error('bad'));
    const result = await makeStore().dispatch(savePlan({ projectId: 'p1', plan }));
    expect(savePlan.rejected.match(result)).toBe(true);
    expect(result.payload).toBe('bad');
  });

  it('assignProjectAgent resolves the updated project', async () => {
    const updated = { ...project, agentId: 'a1' };
    mocked.assignProjectAgentRequest.mockResolvedValue(updated);
    const result = await makeStore().dispatch(
      assignProjectAgent({ projectId: 'p1', agentId: 'a1' }),
    );
    expect(assignProjectAgent.fulfilled.match(result)).toBe(true);
    expect(mocked.assignProjectAgentRequest).toHaveBeenCalledWith('p1', 'a1');
    expect(result.payload).toEqual(updated);
  });

  it('assignProjectAgent rejects with a message on failure', async () => {
    mocked.assignProjectAgentRequest.mockRejectedValue(new Error('locked'));
    const result = await makeStore().dispatch(
      assignProjectAgent({ projectId: 'p1', agentId: 'a1' }),
    );
    expect(assignProjectAgent.rejected.match(result)).toBe(true);
    expect(result.payload).toBe('locked');
  });

  it('runBackupNow returns projectId + jobId', async () => {
    mocked.runBackupNowRequest.mockResolvedValue('j-1');
    const result = await makeStore().dispatch(runBackupNow({ projectId: 'p1' }));
    expect(runBackupNow.fulfilled.match(result)).toBe(true);
    expect(result.payload).toEqual({ projectId: 'p1', jobId: 'j-1' });
  });

  it('runBackupNow rejects with a message on failure', async () => {
    mocked.runBackupNowRequest.mockRejectedValue(new Error('down'));
    const result = await makeStore().dispatch(runBackupNow({ projectId: 'p1' }));
    expect(runBackupNow.rejected.match(result)).toBe(true);
    expect(result.payload).toBe('down');
  });

  it('fetchSchedules resolves the schedule list', async () => {
    mocked.listSchedulesRequest.mockResolvedValue([schedule]);
    const result = await makeStore().dispatch(fetchSchedules());
    expect(fetchSchedules.fulfilled.match(result)).toBe(true);
    expect(result.payload).toEqual([schedule]);
  });

  it('fetchSchedules rejects with a message on failure', async () => {
    mocked.listSchedulesRequest.mockRejectedValue(new Error('x'));
    const result = await makeStore().dispatch(fetchSchedules());
    expect(fetchSchedules.rejected.match(result)).toBe(true);
    expect(result.payload).toBe('x');
  });

  it('saveSchedule updates an existing schedule when scheduleId is present', async () => {
    mocked.updateScheduleRequest.mockResolvedValue(schedule);
    const result = await makeStore().dispatch(
      saveSchedule({ projectId: 'p1', scheduleId: 's1', cron: '0 4 * * *', enabled: false }),
    );
    expect(saveSchedule.fulfilled.match(result)).toBe(true);
    expect(mocked.updateScheduleRequest).toHaveBeenCalledWith('s1', {
      cron: '0 4 * * *',
      enabled: false,
    });
    expect(mocked.createScheduleRequest).not.toHaveBeenCalled();
  });

  it('saveSchedule creates a schedule (defaulting kind) when no scheduleId', async () => {
    mocked.createScheduleRequest.mockResolvedValue(schedule);
    const result = await makeStore().dispatch(
      saveSchedule({ projectId: 'p1', cron: '0 3 * * *', enabled: true }),
    );
    expect(saveSchedule.fulfilled.match(result)).toBe(true);
    expect(mocked.createScheduleRequest).toHaveBeenCalledWith({
      projectId: 'p1',
      kind: 'backup',
      cron: '0 3 * * *',
      enabled: true,
    });
  });

  it('saveSchedule passes an explicit kind through on create', async () => {
    mocked.createScheduleRequest.mockResolvedValue(schedule);
    await makeStore().dispatch(
      saveSchedule({ projectId: 'p1', kind: 'check', cron: '0 3 * * *' }),
    );
    expect(mocked.createScheduleRequest).toHaveBeenCalledWith({
      projectId: 'p1',
      kind: 'check',
      cron: '0 3 * * *',
      enabled: undefined,
    });
  });

  it('saveSchedule rejects with a message on failure', async () => {
    mocked.createScheduleRequest.mockRejectedValue(new Error('boom'));
    const result = await makeStore().dispatch(
      saveSchedule({ projectId: 'p1', cron: '0 3 * * *' }),
    );
    expect(saveSchedule.rejected.match(result)).toBe(true);
    expect(result.payload).toBe('boom');
  });
});
