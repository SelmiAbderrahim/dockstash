import type { RootState } from '@app/store';

export const selectProjects = (state: RootState) => state.projects.items;
export const selectProjectsStatus = (state: RootState) => state.projects.status;
export const selectProjectsError = (state: RootState) => state.projects.error;
export const selectActiveJobForProject = (projectId: string) => (state: RootState) =>
  state.projects.activeJobByProject[projectId] ?? null;
export const selectProjectById = (id: string) => (state: RootState) =>
  state.projects.items.find((p) => p.id === id) ?? null;
export const selectSchedules = (state: RootState) => state.projects.schedules;
export const selectScheduleForProject = (projectId: string) => (state: RootState) =>
  state.projects.schedules.find((s) => s.projectId === projectId) ?? null;
export const selectPlanSaveStatus = (state: RootState) => state.projects.planSaveStatus;
export const selectScheduleSaveStatus = (state: RootState) => state.projects.scheduleSaveStatus;
