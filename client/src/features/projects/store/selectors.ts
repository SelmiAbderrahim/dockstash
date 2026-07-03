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
export const selectDiscoveredFolders = (state: RootState) => state.projects.folders;
export const selectFoldersStatus = (state: RootState) => state.projects.foldersStatus;
export const selectDiscoveredContainers = (state: RootState) => state.projects.containers;
export const selectContainersStatus = (state: RootState) => state.projects.containersStatus;
export const selectDockerAvailable = (state: RootState) => state.projects.dockerAvailable;
export const selectScannedPlan = (state: RootState) => state.projects.scannedPlan;
export const selectScanStatus = (state: RootState) => state.projects.scanStatus;
export const selectCreateStatus = (state: RootState) => state.projects.createStatus;
export const selectAddError = (state: RootState) => state.projects.addError;
export const selectProjectPaths = (state: RootState) =>
  state.projects.items.map((p) => p.path);
export const selectAgentFolders = (state: RootState) => state.projects.agentFolders;
export const selectAgentContainers = (state: RootState) => state.projects.agentContainers;
export const selectAgentDockerAvailable = (state: RootState) =>
  state.projects.agentDockerAvailable;
export const selectAgentSnapshotAt = (state: RootState) => state.projects.agentSnapshotAt;
export const selectAgentDiscoveryStatus = (state: RootState) =>
  state.projects.agentDiscoveryStatus;
