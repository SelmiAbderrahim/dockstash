import { describe, expect, it } from 'vitest';
import {
  selectProjects,
  selectProjectsStatus,
  selectProjectsError,
  selectActiveJobForProject,
  selectProjectById,
  selectSchedules,
  selectScheduleForProject,
  selectPlanSaveStatus,
  selectScheduleSaveStatus,
} from './selectors';
import type { ProjectsState } from './slice';
import type { Project, Schedule } from '../types';
import type { RootState } from '@app/store';

const project = { id: 'p1', name: 'app' } as unknown as Project;
const schedule = { id: 's1', projectId: 'p1' } as unknown as Schedule;

const projects: ProjectsState = {
  items: [project],
  status: 'succeeded',
  error: 'oops',
  activeJobByProject: { p1: 'j-1' },
  schedules: [schedule],
  schedulesStatus: 'idle',
  scheduleSaveStatus: 'loading',
  planSaveStatus: 'failed',
};

const state = { projects } as unknown as RootState;

describe('projects selectors', () => {
  it('reads simple slices of state', () => {
    expect(selectProjects(state)).toEqual([project]);
    expect(selectProjectsStatus(state)).toBe('succeeded');
    expect(selectProjectsError(state)).toBe('oops');
    expect(selectSchedules(state)).toEqual([schedule]);
    expect(selectPlanSaveStatus(state)).toBe('failed');
    expect(selectScheduleSaveStatus(state)).toBe('loading');
  });

  it('selectActiveJobForProject returns the job or null', () => {
    expect(selectActiveJobForProject('p1')(state)).toBe('j-1');
    expect(selectActiveJobForProject('nope')(state)).toBeNull();
  });

  it('selectProjectById finds a project or null', () => {
    expect(selectProjectById('p1')(state)).toEqual(project);
    expect(selectProjectById('nope')(state)).toBeNull();
  });

  it('selectScheduleForProject finds a schedule or null', () => {
    expect(selectScheduleForProject('p1')(state)).toEqual(schedule);
    expect(selectScheduleForProject('nope')(state)).toBeNull();
  });
});
