import { describe, expect, it } from 'vitest';
import {
  projectsReducer,
  clearActiveJob,
  resetSaveStatus,
  resetAddFlow,
  clearPitr,
  PENDING_JOB_ID,
} from './slice';
import {
  fetchProjectJobs,
  fetchProjects,
  fetchSchedules,
  assignProjectAgent,
  runBackupNow,
  savePlan,
  saveSchedule,
  discoverFolders,
  discoverContainers,
  discoverAgent,
  refreshAgent,
  scanProject,
  createProject,
  resolvePitr,
  startPitrRestore,
  saveAlerts,
  saveMirror,
} from './thunks';
import type { PitrResolution, Project, ProjectPlan, Schedule } from '../types';

const initial = () => projectsReducer(undefined, { type: 'unknown' });

const project: Project = {
  id: 'p1',
  owner: 'u1',
  agentId: null,
  name: 'app',
  path: '/var/www/app',
  plan: { paths: ['/var/www/app'], databases: [], configs: [] },
  alertWebhookUrl: '',
  mirror: { enabled: false, sourcePath: '', targetPath: '' },
  lastStatus: 'idle',
  lastError: '',
  lastRunAt: null,
  lastCheckAt: null,
  lastCheckStatus: null,
  lastCheckDetail: '',
  lastDrillAt: null,
  lastDrillStatus: null,
  lastDrillDetail: '',
  lastRestoreAt: null,
  lastRestoreStatus: null,
  lastRestoreDetail: '',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('projects slice', () => {
  it('starts empty', () => {
    const s = initial();
    expect(s.items).toEqual([]);
    expect(s.status).toBe('idle');
  });

  it('fetchProjects lifecycle', () => {
    let s = projectsReducer(initial(), { type: fetchProjects.pending.type });
    expect(s.status).toBe('loading');
    s = projectsReducer(s, { type: fetchProjects.fulfilled.type, payload: [project] });
    expect(s.status).toBe('succeeded');
    expect(s.items).toHaveLength(1);
    s = projectsReducer(s, { type: fetchProjects.rejected.type, payload: 'boom' });
    expect(s.status).toBe('failed');
    expect(s.error).toBe('boom');
  });

  it('runBackupNow.pending disables the button before the request resolves', () => {
    const s = projectsReducer(initial(), {
      type: runBackupNow.pending.type,
      meta: { arg: { projectId: 'p1' } },
    });
    expect(s.activeJobByProject['p1']).toBe(PENDING_JOB_ID);
  });

  it('runBackupNow.rejected clears the pending marker so the button re-enables', () => {
    let s = projectsReducer(initial(), {
      type: runBackupNow.pending.type,
      meta: { arg: { projectId: 'p1' } },
    });
    s = projectsReducer(s, {
      type: runBackupNow.rejected.type,
      meta: { arg: { projectId: 'p1' } },
      payload: 'busy',
    });
    expect(s.activeJobByProject['p1']).toBeNull();
    expect(s.error).toBe('busy');
  });

  it('runBackupNow.fulfilled tracks the active job', () => {
    const s = projectsReducer(initial(), {
      type: runBackupNow.fulfilled.type,
      payload: { projectId: 'p1', jobId: 'j-1' },
    });
    expect(s.activeJobByProject['p1']).toBe('j-1');
  });

  it('clearActiveJob nulls the job for a project', () => {
    let s = projectsReducer(initial(), {
      type: runBackupNow.fulfilled.type,
      payload: { projectId: 'p1', jobId: 'j-1' },
    });
    s = projectsReducer(s, clearActiveJob({ projectId: 'p1' }));
    expect(s.activeJobByProject['p1']).toBeNull();
  });

  it('fetchProjects.rejected falls back to a default message when no payload', () => {
    const s = projectsReducer(initial(), { type: fetchProjects.rejected.type });
    expect(s.status).toBe('failed');
    expect(s.error).toBe('Could not load projects.');
  });

  it('runBackupNow.rejected records the error (payload and fallback)', () => {
    let s = projectsReducer(initial(), {
      type: runBackupNow.rejected.type,
      meta: { arg: { projectId: 'p1' } },
      payload: 'no dice',
    });
    expect(s.error).toBe('no dice');
    s = projectsReducer(initial(), {
      type: runBackupNow.rejected.type,
      meta: { arg: { projectId: 'p1' } },
    });
    expect(s.error).toBe('Could not start backup.');
  });

  it('savePlan lifecycle updates the matching project in place', () => {
    const seeded = projectsReducer(initial(), {
      type: fetchProjects.fulfilled.type,
      payload: [project],
    });
    let s = projectsReducer(seeded, { type: savePlan.pending.type });
    expect(s.planSaveStatus).toBe('loading');

    const updated = { ...project, name: 'renamed' };
    s = projectsReducer(s, { type: savePlan.fulfilled.type, payload: updated });
    expect(s.planSaveStatus).toBe('succeeded');
    expect(s.items[0]?.name).toBe('renamed');

    // Fulfilled for an unknown project id leaves items untouched
    s = projectsReducer(s, {
      type: savePlan.fulfilled.type,
      payload: { ...project, id: 'ghost', name: 'x' },
    });
    expect(s.items).toHaveLength(1);
  });

  it('savePlan.rejected records the error (payload and fallback)', () => {
    let s = projectsReducer(initial(), { type: savePlan.rejected.type, payload: 'plan boom' });
    expect(s.planSaveStatus).toBe('failed');
    expect(s.error).toBe('plan boom');
    s = projectsReducer(initial(), { type: savePlan.rejected.type });
    expect(s.error).toBe('Could not save plan.');
  });

  it('assignProjectAgent.fulfilled updates the matching project in place', () => {
    const seeded = projectsReducer(initial(), {
      type: fetchProjects.fulfilled.type,
      payload: [project],
    });
    const updated = { ...project, agentId: 'a1' };
    let s = projectsReducer(seeded, { type: assignProjectAgent.fulfilled.type, payload: updated });
    expect(s.items[0]?.agentId).toBe('a1');

    // Fulfilled for an unknown project id leaves items untouched.
    s = projectsReducer(s, {
      type: assignProjectAgent.fulfilled.type,
      payload: { ...project, id: 'ghost', agentId: 'a2' },
    });
    expect(s.items).toHaveLength(1);
  });

  it('assignProjectAgent.rejected records the error (payload and fallback)', () => {
    let s = projectsReducer(initial(), {
      type: assignProjectAgent.rejected.type,
      payload: 'locked',
    });
    expect(s.error).toBe('locked');
    s = projectsReducer(initial(), { type: assignProjectAgent.rejected.type });
    expect(s.error).toBe('Could not assign the agent.');
  });

  it('fetchSchedules lifecycle', () => {
    let s = projectsReducer(initial(), { type: fetchSchedules.pending.type });
    expect(s.schedulesStatus).toBe('loading');
    s = projectsReducer(s, { type: fetchSchedules.fulfilled.type, payload: [] });
    expect(s.schedulesStatus).toBe('succeeded');
    s = projectsReducer(s, { type: fetchSchedules.rejected.type, payload: 'sched boom' });
    expect(s.schedulesStatus).toBe('failed');
    expect(s.error).toBe('sched boom');
    s = projectsReducer(initial(), { type: fetchSchedules.rejected.type });
    expect(s.error).toBe('Could not load schedules.');
  });

  it('saveSchedule.fulfilled upserts the schedule', () => {
    const sched: Schedule = {
      id: 's1',
      projectId: 'p1',
      kind: 'backup',
      cron: '0 3 * * *',
      enabled: true,
      retention: { keepDaily: 7, keepWeekly: 4, keepMonthly: 6, keepHourly: 0, keepLast: 0 },
      createdAt: '',
      updatedAt: '',
    };
    let s = projectsReducer(initial(), { type: saveSchedule.pending.type });
    expect(s.scheduleSaveStatus).toBe('loading');
    s = projectsReducer(s, { type: saveSchedule.fulfilled.type, payload: sched });
    expect(s.schedules).toHaveLength(1);
    expect(s.scheduleSaveStatus).toBe('succeeded');
    // Update the existing schedule
    s = projectsReducer(s, {
      type: saveSchedule.fulfilled.type,
      payload: { ...sched, cron: '0 4 * * *' },
    });
    expect(s.schedules).toHaveLength(1);
    expect(s.schedules[0]?.cron).toBe('0 4 * * *');
  });

  it('saveSchedule.rejected records the error (payload and fallback)', () => {
    let s = projectsReducer(initial(), {
      type: saveSchedule.rejected.type,
      payload: 'save boom',
    });
    expect(s.scheduleSaveStatus).toBe('failed');
    expect(s.error).toBe('save boom');
    s = projectsReducer(initial(), { type: saveSchedule.rejected.type });
    expect(s.error).toBe('Could not save schedule.');
  });

  it('discoverFolders lifecycle', () => {
    let s = projectsReducer(initial(), { type: discoverFolders.pending.type });
    expect(s.foldersStatus).toBe('loading');
    const folders = [{ name: 'app', path: '/var/www/app', hasCompose: true, composeFile: 'docker-compose.yml' }];
    s = projectsReducer(s, { type: discoverFolders.fulfilled.type, payload: folders });
    expect(s.foldersStatus).toBe('succeeded');
    expect(s.folders).toEqual(folders);
    s = projectsReducer(s, { type: discoverFolders.rejected.type, payload: 'fs boom' });
    expect(s.foldersStatus).toBe('failed');
    expect(s.addError).toBe('fs boom');
    s = projectsReducer(initial(), { type: discoverFolders.rejected.type });
    expect(s.addError).toBe('Could not scan folders.');
  });

  it('discoverContainers lifecycle carries dockerAvailable', () => {
    let s = projectsReducer(initial(), { type: discoverContainers.pending.type });
    expect(s.containersStatus).toBe('loading');
    s = projectsReducer(s, {
      type: discoverContainers.fulfilled.type,
      payload: { containers: [{ project: 'shop' }], dockerAvailable: true },
    });
    expect(s.containersStatus).toBe('succeeded');
    expect(s.dockerAvailable).toBe(true);
    expect(s.containers).toHaveLength(1);
    s = projectsReducer(s, { type: discoverContainers.rejected.type, payload: 'docker boom' });
    expect(s.containersStatus).toBe('failed');
    expect(s.addError).toBe('docker boom');
    s = projectsReducer(initial(), { type: discoverContainers.rejected.type });
    expect(s.addError).toBe('Could not list containers.');
  });

  it('discoverAgent lifecycle fills folders + containers from one snapshot', () => {
    let s = projectsReducer(initial(), { type: discoverAgent.pending.type });
    expect(s.agentDiscoveryStatus).toBe('loading');
    s = projectsReducer(s, {
      type: discoverAgent.fulfilled.type,
      payload: {
        folders: [{ name: 'a', path: '/var/www/a', hasCompose: false, composeFile: null, plan: { paths: ['/var/www/a'], databases: [], configs: [] } }],
        containers: [{ project: 'p', workingDir: '/var/www/p', configFiles: [], services: [], containerNames: [], addable: true, standalone: false, plan: { paths: ['/var/www/p'], databases: [], configs: [] } }],
        dockerAvailable: true,
        snapshotAt: '2026-07-03T00:00:00Z',
        reported: true,
        errors: ['Docker socket is unreachable.'],
      },
    });
    expect(s.agentDiscoveryStatus).toBe('succeeded');
    expect(s.agentFolders).toHaveLength(1);
    expect(s.agentContainers).toHaveLength(1);
    expect(s.agentDockerAvailable).toBe(true);
    expect(s.agentSnapshotAt).toBe('2026-07-03T00:00:00Z');
    expect(s.agentReported).toBe(true);
    expect(s.agentDiscoveryErrors).toEqual(['Docker socket is unreachable.']);
    s = projectsReducer(s, { type: discoverAgent.rejected.type, payload: 'gone' });
    expect(s.agentDiscoveryStatus).toBe('failed');
    expect(s.addError).toBe('gone');
    s = projectsReducer(initial(), { type: discoverAgent.rejected.type });
    expect(s.addError).toBe('Could not load agent discovery.');
  });

  it('refreshAgent lifecycle', () => {
    let s = projectsReducer(initial(), { type: refreshAgent.pending.type });
    expect(s.agentRefreshStatus).toBe('loading');
    s = projectsReducer(s, { type: refreshAgent.fulfilled.type });
    expect(s.agentRefreshStatus).toBe('succeeded');
    s = projectsReducer(s, { type: refreshAgent.rejected.type, payload: 'locked' });
    expect(s.agentRefreshStatus).toBe('failed');
    expect(s.addError).toBe('locked');
    s = projectsReducer(initial(), { type: refreshAgent.rejected.type });
    expect(s.addError).toBe('Could not request a refresh.');
  });

  it('scanProject lifecycle stores and clears the scanned plan', () => {
    const plan: ProjectPlan = { paths: ['/var/www/app'], databases: [], configs: [] };
    let s = projectsReducer(
      { ...initial(), scannedPlan: plan },
      { type: scanProject.pending.type },
    );
    expect(s.scanStatus).toBe('loading');
    expect(s.scannedPlan).toBeNull();
    s = projectsReducer(s, { type: scanProject.fulfilled.type, payload: plan });
    expect(s.scanStatus).toBe('succeeded');
    expect(s.scannedPlan).toEqual(plan);
    s = projectsReducer(s, { type: scanProject.rejected.type, payload: 'scan boom' });
    expect(s.scanStatus).toBe('failed');
    expect(s.addError).toBe('scan boom');
    s = projectsReducer(initial(), { type: scanProject.rejected.type });
    expect(s.addError).toBe('Could not scan the project.');
  });

  it('createProject.fulfilled prepends the new project', () => {
    const seeded = projectsReducer(initial(), {
      type: fetchProjects.fulfilled.type,
      payload: [project],
    });
    let s = projectsReducer(seeded, { type: createProject.pending.type });
    expect(s.createStatus).toBe('loading');
    const fresh = { ...project, id: 'p2', name: 'new' };
    s = projectsReducer(s, { type: createProject.fulfilled.type, payload: fresh });
    expect(s.createStatus).toBe('succeeded');
    expect(s.items[0]?.id).toBe('p2');
    expect(s.items).toHaveLength(2);
    s = projectsReducer(s, { type: createProject.rejected.type, payload: 'dup' });
    expect(s.createStatus).toBe('failed');
    expect(s.addError).toBe('dup');
    s = projectsReducer(initial(), { type: createProject.rejected.type });
    expect(s.addError).toBe('Could not create the project.');
  });

  it('resetAddFlow clears scan/create state', () => {
    const plan: ProjectPlan = { paths: ['/var/www/app'], databases: [], configs: [] };
    let s = projectsReducer({ ...initial(), scannedPlan: plan, addError: 'x' }, {
      type: scanProject.fulfilled.type,
      payload: plan,
    });
    s = projectsReducer(s, resetAddFlow());
    expect(s.scannedPlan).toBeNull();
    expect(s.scanStatus).toBe('idle');
    expect(s.createStatus).toBe('idle');
    expect(s.addError).toBeNull();
  });

  it('resetSaveStatus returns save statuses to idle', () => {
    let s = projectsReducer(initial(), { type: savePlan.pending.type });
    s = projectsReducer(s, { type: saveSchedule.pending.type });
    s = projectsReducer(s, { type: saveAlerts.rejected.type, payload: 'a' });
    s = projectsReducer(s, { type: saveMirror.rejected.type, payload: 'm' });
    expect(s.planSaveStatus).toBe('loading');
    expect(s.scheduleSaveStatus).toBe('loading');
    expect(s.alertsSaveStatus).toBe('failed');
    expect(s.mirrorSaveStatus).toBe('failed');
    s = projectsReducer(s, resetSaveStatus());
    expect(s.planSaveStatus).toBe('idle');
    expect(s.scheduleSaveStatus).toBe('idle');
    expect(s.alertsSaveStatus).toBe('idle');
    expect(s.alertsError).toBeNull();
    expect(s.mirrorSaveStatus).toBe('idle');
    expect(s.mirrorError).toBeNull();
  });

  it('resolvePitr lifecycle stores the resolution', () => {
    const resolution: PitrResolution = {
      target: '2026-07-01T10:00:00.000Z',
      gapSeconds: 90,
      snapshot: { id: 'snap1', time: '2026-07-01T09:58:30.000Z' },
    };
    let s = projectsReducer(initial(), { type: resolvePitr.pending.type });
    expect(s.pitr.status).toBe('loading');
    expect(s.pitr.resolution).toBeNull();
    s = projectsReducer(s, { type: resolvePitr.fulfilled.type, payload: resolution });
    expect(s.pitr.status).toBe('succeeded');
    expect(s.pitr.resolution).toEqual(resolution);
    s = projectsReducer(s, { type: resolvePitr.rejected.type, payload: 'no snapshot' });
    expect(s.pitr.status).toBe('failed');
    expect(s.pitr.error).toBe('no snapshot');
    s = projectsReducer(initial(), { type: resolvePitr.rejected.type });
    expect(s.pitr.error).toBe('Could not resolve the point in time.');
  });

  it('startPitrRestore lifecycle tracks the restore job', () => {
    let s = projectsReducer(initial(), { type: startPitrRestore.pending.type });
    expect(s.pitr.restoreStatus).toBe('loading');
    s = projectsReducer(s, { type: startPitrRestore.fulfilled.type, payload: { jobId: 'j-9' } });
    expect(s.pitr.restoreStatus).toBe('succeeded');
    expect(s.pitr.restoreJobId).toBe('j-9');
    s = projectsReducer(s, { type: startPitrRestore.rejected.type, payload: 'busy' });
    expect(s.pitr.restoreStatus).toBe('failed');
    expect(s.pitr.error).toBe('busy');
    s = projectsReducer(initial(), { type: startPitrRestore.rejected.type });
    expect(s.pitr.error).toBe('Could not start the restore.');
  });

  it('clearPitr resets the whole pitr flow', () => {
    let s = projectsReducer(initial(), {
      type: resolvePitr.fulfilled.type,
      payload: {
        target: '2026-07-01T10:00:00.000Z',
        gapSeconds: 90,
        snapshot: { id: 'snap1', time: '2026-07-01T09:58:30.000Z' },
      },
    });
    s = projectsReducer(s, { type: startPitrRestore.fulfilled.type, payload: { jobId: 'j-9' } });
    s = projectsReducer(s, clearPitr());
    expect(s.pitr.resolution).toBeNull();
    expect(s.pitr.status).toBe('idle');
    expect(s.pitr.error).toBeNull();
    expect(s.pitr.restoreJobId).toBeNull();
    expect(s.pitr.restoreStatus).toBe('idle');
  });

  it('saveAlerts lifecycle updates the matching project in place', () => {
    const seeded = projectsReducer(initial(), {
      type: fetchProjects.fulfilled.type,
      payload: [project],
    });
    let s = projectsReducer(seeded, { type: saveAlerts.pending.type });
    expect(s.alertsSaveStatus).toBe('loading');
    const updated = { ...project, alertWebhookUrl: 'https://x' };
    s = projectsReducer(s, { type: saveAlerts.fulfilled.type, payload: updated });
    expect(s.alertsSaveStatus).toBe('succeeded');
    expect(s.items[0]?.alertWebhookUrl).toBe('https://x');
    // Fulfilled for an unknown project id leaves items untouched.
    s = projectsReducer(s, {
      type: saveAlerts.fulfilled.type,
      payload: { ...project, id: 'ghost', alertWebhookUrl: 'https://y' },
    });
    expect(s.items).toHaveLength(1);
    s = projectsReducer(s, { type: saveAlerts.rejected.type, payload: 'alerts boom' });
    expect(s.alertsSaveStatus).toBe('failed');
    expect(s.alertsError).toBe('alerts boom');
    s = projectsReducer(initial(), { type: saveAlerts.rejected.type });
    expect(s.alertsError).toBe('Could not save alerts.');
  });

  it('saveMirror lifecycle updates the matching project in place', () => {
    const seeded = projectsReducer(initial(), {
      type: fetchProjects.fulfilled.type,
      payload: [project],
    });
    let s = projectsReducer(seeded, { type: saveMirror.pending.type });
    expect(s.mirrorSaveStatus).toBe('loading');
    const updated = {
      ...project,
      mirror: { enabled: true, sourcePath: '/src', targetPath: '/dst' },
    };
    s = projectsReducer(s, { type: saveMirror.fulfilled.type, payload: updated });
    expect(s.mirrorSaveStatus).toBe('succeeded');
    expect(s.items[0]?.mirror.enabled).toBe(true);
    // Fulfilled for an unknown project id leaves items untouched.
    s = projectsReducer(s, {
      type: saveMirror.fulfilled.type,
      payload: { ...updated, id: 'ghost' },
    });
    expect(s.items).toHaveLength(1);
    s = projectsReducer(s, { type: saveMirror.rejected.type, payload: 'mirror boom' });
    expect(s.mirrorSaveStatus).toBe('failed');
    expect(s.mirrorError).toBe('mirror boom');
    s = projectsReducer(initial(), { type: saveMirror.rejected.type });
    expect(s.mirrorError).toBe('Could not save mirror.');
  });

  it('fetchProjectJobs lifecycle keeps history scoped to one project', () => {
    const job = { id: 'j1', kind: 'restore' } as never;
    // First load.
    let s = projectsReducer(initial(), fetchProjectJobs.pending('r1', { projectId: 'p1' }));
    expect(s.jobsStatus).toBe('loading');
    expect(s.jobsProjectId).toBe('p1');
    s = projectsReducer(
      s,
      fetchProjectJobs.fulfilled({ projectId: 'p1', jobs: [job] }, 'r1', { projectId: 'p1' }),
    );
    expect(s.jobsStatus).toBe('succeeded');
    expect(s.jobs).toEqual([job]);

    // Refetch of the SAME project keeps the rows visible while loading.
    s = projectsReducer(s, fetchProjectJobs.pending('r2', { projectId: 'p1' }));
    expect(s.jobs).toEqual([job]);

    // Switching projects clears the stale rows immediately.
    s = projectsReducer(s, fetchProjectJobs.pending('r3', { projectId: 'p2' }));
    expect(s.jobs).toEqual([]);
    expect(s.jobsProjectId).toBe('p2');
  });

  it('fetchProjectJobs failure records the error (payload and fallback)', () => {
    let s = projectsReducer(initial(), fetchProjectJobs.pending('r1', { projectId: 'p1' }));
    s = projectsReducer(
      s,
      fetchProjectJobs.rejected(new Error('x'), 'r1', { projectId: 'p1' }, 'boom'),
    );
    expect(s.jobsStatus).toBe('failed');
    expect(s.jobsError).toBe('boom');

    let s2 = projectsReducer(initial(), fetchProjectJobs.pending('r2', { projectId: 'p1' }));
    s2 = projectsReducer(s2, {
      type: fetchProjectJobs.rejected.type,
      meta: { arg: { projectId: 'p1' } },
    });
    expect(s2.jobsError).toBe('Could not load job history.');
  });
});
