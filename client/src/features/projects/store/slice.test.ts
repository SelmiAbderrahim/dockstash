import { describe, expect, it } from 'vitest';
import { projectsReducer, clearActiveJob } from './slice';
import { fetchProjects, runBackupNow, saveSchedule } from './thunks';
import type { Project, Schedule } from '../types';

const initial = () => projectsReducer(undefined, { type: 'unknown' });

const project: Project = {
  id: 'p1',
  owner: 'u1',
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
    let s = projectsReducer(initial(), { type: saveSchedule.fulfilled.type, payload: sched });
    expect(s.schedules).toHaveLength(1);
    // Update the existing schedule
    s = projectsReducer(s, {
      type: saveSchedule.fulfilled.type,
      payload: { ...sched, cron: '0 4 * * *' },
    });
    expect(s.schedules).toHaveLength(1);
    expect(s.schedules[0]?.cron).toBe('0 4 * * *');
  });
});
