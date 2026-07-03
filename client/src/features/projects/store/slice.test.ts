import { describe, expect, it } from 'vitest';
import { projectsReducer, clearActiveJob, resetSaveStatus, resetAddFlow } from './slice';
import {
  fetchProjects,
  fetchSchedules,
  assignProjectAgent,
  runBackupNow,
  savePlan,
  saveSchedule,
  discoverFolders,
  discoverContainers,
  discoverAgent,
  scanProject,
  createProject,
} from './thunks';
import type { Project, ProjectPlan, Schedule } from '../types';

const initial = () => projectsReducer(undefined, { type: 'unknown' });

const project: Project = {
  id: 'p1',
  owner: 'u1',
  agentId: null,
  name: 'app',
  path: '/var/www/app',
  plan: { paths: ['/var/www/app'], databases: [], configs: [] },
  lastStatus: 'idle',
  lastError: '',
  lastRunAt: null,
  lastCheckAt: null,
  lastCheckStatus: null,
  lastCheckDetail: '',
  lastDrillAt: null,
  lastDrillStatus: null,
  lastDrillDetail: '',
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
      payload: 'no dice',
    });
    expect(s.error).toBe('no dice');
    s = projectsReducer(initial(), { type: runBackupNow.rejected.type });
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
      retention: { keepDaily: 7, keepWeekly: 4, keepMonthly: 6 },
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
      },
    });
    expect(s.agentDiscoveryStatus).toBe('succeeded');
    expect(s.agentFolders).toHaveLength(1);
    expect(s.agentContainers).toHaveLength(1);
    expect(s.agentDockerAvailable).toBe(true);
    expect(s.agentSnapshotAt).toBe('2026-07-03T00:00:00Z');
    s = projectsReducer(s, { type: discoverAgent.rejected.type, payload: 'gone' });
    expect(s.agentDiscoveryStatus).toBe('failed');
    expect(s.addError).toBe('gone');
    s = projectsReducer(initial(), { type: discoverAgent.rejected.type });
    expect(s.addError).toBe('Could not load agent discovery.');
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
    expect(s.planSaveStatus).toBe('loading');
    expect(s.scheduleSaveStatus).toBe('loading');
    s = projectsReducer(s, resetSaveStatus());
    expect(s.planSaveStatus).toBe('idle');
    expect(s.scheduleSaveStatus).toBe('idle');
  });
});
