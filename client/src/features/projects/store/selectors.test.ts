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
  selectDiscoveredFolders,
  selectFoldersStatus,
  selectDiscoveredContainers,
  selectContainersStatus,
  selectDockerAvailable,
  selectScannedPlan,
  selectScanStatus,
  selectCreateStatus,
  selectAddError,
  selectProjectPaths,
} from './selectors';
import type { ProjectsState } from './slice';
import type { Project, Schedule } from '../types';
import type { RootState } from '@app/store';

const project = { id: 'p1', name: 'app', path: '/var/www/app' } as unknown as Project;
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
  folders: [{ name: 'app', path: '/var/www/app', hasCompose: true, composeFile: 'docker-compose.yml' }],
  foldersStatus: 'succeeded',
  containers: [
    {
      project: 'shop',
      workingDir: '/var/www/shop',
      configFiles: [],
      services: ['db'],
      containerNames: ['shop_db_1'],
      addable: true,
      standalone: false,
    },
  ],
  dockerAvailable: true,
  containersStatus: 'succeeded',
  scannedPlan: { paths: ['/var/www/app'], databases: [], configs: [] },
  scanStatus: 'succeeded',
  createStatus: 'idle',
  addError: 'add oops',
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

  it('reads the add-project discovery slices', () => {
    expect(selectDiscoveredFolders(state)).toHaveLength(1);
    expect(selectFoldersStatus(state)).toBe('succeeded');
    expect(selectDiscoveredContainers(state)[0]?.project).toBe('shop');
    expect(selectContainersStatus(state)).toBe('succeeded');
    expect(selectDockerAvailable(state)).toBe(true);
    expect(selectScannedPlan(state)?.paths).toEqual(['/var/www/app']);
    expect(selectScanStatus(state)).toBe('succeeded');
    expect(selectCreateStatus(state)).toBe('idle');
    expect(selectAddError(state)).toBe('add oops');
    expect(selectProjectPaths(state)).toEqual(['/var/www/app']);
  });
});
