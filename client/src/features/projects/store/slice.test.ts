import { describe, expect, it } from 'vitest';
import { projectsReducer, clearActiveJob, resetSaveStatus } from './slice';
import {
  fetchProjects,
  fetchSchedules,
  assignProjectAgent,
  runBackupNow,
  savePlan,
  saveSchedule,
} from './thunks';
import type { Project, Schedule } from '../types';

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
