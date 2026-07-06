import { describe, expect, it, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { projectsReducer } from './slice';
import {
  fetchProjects,
  discoverFolders,
  discoverContainers,
  discoverAgent,
  refreshAgent,
  scanProject,
  createProject,
  savePlan,
  assignProjectAgent,
  runBackupNow,
  fetchProjectJobs,
  fetchSchedules,
  saveSchedule,
  resolvePitr,
  startPitrRestore,
  saveAlerts,
  saveMirror,
} from './thunks';
import type { PitrResolution, Project, ProjectPlan, Schedule } from '../types';
import * as api from '../api';

vi.mock('../api', () => ({
  listProjectsRequest: vi.fn(),
  discoverFoldersRequest: vi.fn(),
  discoverContainersRequest: vi.fn(),
  discoverAgentRequest: vi.fn(),
  refreshAgentDiscoveryRequest: vi.fn(),
  scanProjectRequest: vi.fn(),
  createProjectRequest: vi.fn(),
  updatePlanRequest: vi.fn(),
  assignProjectAgentRequest: vi.fn(),
  runBackupNowRequest: vi.fn(),
  listProjectJobsRequest: vi.fn(),
  listSchedulesRequest: vi.fn(),
  createScheduleRequest: vi.fn(),
  updateScheduleRequest: vi.fn(),
  resolvePitrRequest: vi.fn(),
  pitrRestoreRequest: vi.fn(),
  updateAlertsRequest: vi.fn(),
  updateMirrorRequest: vi.fn(),
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

  it('discoverFolders resolves the folder list / rejects with a message', async () => {
    mocked.discoverFoldersRequest.mockResolvedValue([{ name: 'app' }] as never);
    let result = await makeStore().dispatch(discoverFolders());
    expect(discoverFolders.fulfilled.match(result)).toBe(true);
    expect(result.payload).toEqual([{ name: 'app' }]);

    mocked.discoverFoldersRequest.mockRejectedValue(new Error('fs'));
    result = await makeStore().dispatch(discoverFolders());
    expect(discoverFolders.rejected.match(result)).toBe(true);
    expect(result.payload).toBe('fs');
  });

  it('discoverContainers resolves the result / rejects with a message', async () => {
    const payload = { containers: [], dockerAvailable: true };
    mocked.discoverContainersRequest.mockResolvedValue(payload as never);
    let result = await makeStore().dispatch(discoverContainers());
    expect(discoverContainers.fulfilled.match(result)).toBe(true);
    expect(result.payload).toEqual(payload);

    mocked.discoverContainersRequest.mockRejectedValue(new Error('docker'));
    result = await makeStore().dispatch(discoverContainers());
    expect(discoverContainers.rejected.match(result)).toBe(true);
    expect(result.payload).toBe('docker');
  });

  it('discoverAgent resolves the snapshot / rejects with a message', async () => {
    const snap = {
      folders: [],
      containers: [],
      dockerAvailable: true,
      snapshotAt: null,
      reported: true,
      errors: [],
    };
    mocked.discoverAgentRequest.mockResolvedValue(snap as never);
    let result = await makeStore().dispatch(discoverAgent({ agentId: 'a1' }));
    expect(discoverAgent.fulfilled.match(result)).toBe(true);
    expect(mocked.discoverAgentRequest).toHaveBeenCalledWith('a1');
    expect(result.payload).toEqual(snap);

    mocked.discoverAgentRequest.mockRejectedValue(new Error('gone'));
    result = await makeStore().dispatch(discoverAgent({ agentId: 'a1' }));
    expect(discoverAgent.rejected.match(result)).toBe(true);
    expect(result.payload).toBe('gone');
  });

  it('refreshAgent requests a refresh for the given agent / rejects with a message', async () => {
    mocked.refreshAgentDiscoveryRequest.mockResolvedValue(undefined);
    let result = await makeStore().dispatch(refreshAgent({ agentId: 'a1' }));
    expect(refreshAgent.fulfilled.match(result)).toBe(true);
    expect(mocked.refreshAgentDiscoveryRequest).toHaveBeenCalledWith('a1');

    mocked.refreshAgentDiscoveryRequest.mockRejectedValue(new Error('locked'));
    result = await makeStore().dispatch(refreshAgent({ agentId: 'a1' }));
    expect(refreshAgent.rejected.match(result)).toBe(true);
    expect(result.payload).toBe('locked');
  });

  it('scanProject resolves the plan / rejects with a message', async () => {
    mocked.scanProjectRequest.mockResolvedValue(plan);
    let result = await makeStore().dispatch(scanProject({ path: '/var/www/app' }));
    expect(scanProject.fulfilled.match(result)).toBe(true);
    expect(mocked.scanProjectRequest).toHaveBeenCalledWith('/var/www/app');
    expect(result.payload).toEqual(plan);

    mocked.scanProjectRequest.mockRejectedValue(new Error('no compose'));
    result = await makeStore().dispatch(scanProject({ path: '/var/www/app' }));
    expect(scanProject.rejected.match(result)).toBe(true);
    expect(result.payload).toBe('no compose');
  });

  it('createProject resolves the project / rejects with a message', async () => {
    mocked.createProjectRequest.mockResolvedValue(project);
    const input = { name: 'app', path: '/var/www/app', repoPassword: 'password1', plan, agentId: 'a1' };
    let result = await makeStore().dispatch(createProject(input));
    expect(createProject.fulfilled.match(result)).toBe(true);
    expect(mocked.createProjectRequest).toHaveBeenCalledWith(input);
    expect(result.payload).toEqual(project);

    mocked.createProjectRequest.mockRejectedValue(new Error('dup'));
    result = await makeStore().dispatch(createProject(input));
    expect(createProject.rejected.match(result)).toBe(true);
    expect(result.payload).toBe('dup');
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

  it('fetchProjectJobs resolves jobs keyed to the project', async () => {
    mocked.listProjectJobsRequest.mockResolvedValue([
      { id: 'j1', kind: 'restore' } as never,
    ]);
    const result = await makeStore().dispatch(fetchProjectJobs({ projectId: 'p1' }));
    expect(fetchProjectJobs.fulfilled.match(result)).toBe(true);
    expect(result.payload).toEqual({
      projectId: 'p1',
      jobs: [{ id: 'j1', kind: 'restore' }],
    });
  });

  it('fetchProjectJobs rejects with a message on failure', async () => {
    mocked.listProjectJobsRequest.mockRejectedValue(new Error('nope'));
    const result = await makeStore().dispatch(fetchProjectJobs({ projectId: 'p1' }));
    expect(fetchProjectJobs.rejected.match(result)).toBe(true);
    expect(result.payload).toBe('nope');
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

  it('resolvePitr resolves the closest snapshot / rejects with a message', async () => {
    const resolution: PitrResolution = {
      target: '2026-07-01T10:00:00.000Z',
      gapSeconds: 90,
      snapshot: { id: 'snap1', time: '2026-07-01T09:58:30.000Z' },
    };
    mocked.resolvePitrRequest.mockResolvedValue(resolution);
    let result = await makeStore().dispatch(
      resolvePitr({ projectId: 'p1', ts: '2026-07-01T10:00:00.000Z' }),
    );
    expect(resolvePitr.fulfilled.match(result)).toBe(true);
    expect(mocked.resolvePitrRequest).toHaveBeenCalledWith('p1', '2026-07-01T10:00:00.000Z');
    expect(result.payload).toEqual(resolution);

    mocked.resolvePitrRequest.mockRejectedValue(new Error('no snapshot'));
    result = await makeStore().dispatch(
      resolvePitr({ projectId: 'p1', ts: '2026-07-01T10:00:00.000Z' }),
    );
    expect(resolvePitr.rejected.match(result)).toBe(true);
    expect(result.payload).toBe('no snapshot');
  });

  it('startPitrRestore returns the enqueued jobId / rejects with a message', async () => {
    mocked.pitrRestoreRequest.mockResolvedValue('j-9');
    const input = { projectId: 'p1', snapshotId: 'snap1', overwrite: false, targetPath: '/dst' };
    let result = await makeStore().dispatch(startPitrRestore(input));
    expect(startPitrRestore.fulfilled.match(result)).toBe(true);
    expect(mocked.pitrRestoreRequest).toHaveBeenCalledWith(input);
    expect(result.payload).toEqual({ jobId: 'j-9' });

    mocked.pitrRestoreRequest.mockRejectedValue(new Error('busy'));
    result = await makeStore().dispatch(startPitrRestore(input));
    expect(startPitrRestore.rejected.match(result)).toBe(true);
    expect(result.payload).toBe('busy');
  });

  it('saveAlerts resolves the updated project / rejects with a message', async () => {
    const updated = { ...project, alertWebhookUrl: 'https://x' } as Project;
    mocked.updateAlertsRequest.mockResolvedValue(updated);
    let result = await makeStore().dispatch(saveAlerts({ projectId: 'p1', webhookUrl: 'https://x' }));
    expect(saveAlerts.fulfilled.match(result)).toBe(true);
    expect(mocked.updateAlertsRequest).toHaveBeenCalledWith('p1', 'https://x');
    expect(result.payload).toEqual(updated);

    mocked.updateAlertsRequest.mockRejectedValue(new Error('alertsLocked'));
    result = await makeStore().dispatch(saveAlerts({ projectId: 'p1', webhookUrl: 'https://x' }));
    expect(saveAlerts.rejected.match(result)).toBe(true);
    expect(result.payload).toBe('alertsLocked');
  });

  it('saveMirror resolves the updated project / rejects with a message', async () => {
    const mirror = { enabled: true, sourcePath: '/src', targetPath: '/dst' };
    const updated = { ...project, mirror } as Project;
    mocked.updateMirrorRequest.mockResolvedValue(updated);
    let result = await makeStore().dispatch(saveMirror({ projectId: 'p1', ...mirror }));
    expect(saveMirror.fulfilled.match(result)).toBe(true);
    expect(mocked.updateMirrorRequest).toHaveBeenCalledWith('p1', mirror);
    expect(result.payload).toEqual(updated);

    mocked.updateMirrorRequest.mockRejectedValue(new Error('mirrorLocked'));
    result = await makeStore().dispatch(saveMirror({ projectId: 'p1', ...mirror }));
    expect(saveMirror.rejected.match(result)).toBe(true);
    expect(result.payload).toBe('mirrorLocked');
  });
});
