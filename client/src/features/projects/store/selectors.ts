import { createSelector } from '@reduxjs/toolkit';
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
export const selectProjectPaths = createSelector([selectProjects], (projects) =>
  projects.map((p) => p.path),
);
export const selectAgentFolders = (state: RootState) => state.projects.agentFolders;
export const selectAgentContainers = (state: RootState) => state.projects.agentContainers;
export const selectAgentDockerAvailable = (state: RootState) =>
  state.projects.agentDockerAvailable;
export const selectAgentRoots = (state: RootState) => state.projects.agentRoots;
export const selectAgentSnapshotAt = (state: RootState) => state.projects.agentSnapshotAt;
export const selectAgentDiscoveryStatus = (state: RootState) =>
  state.projects.agentDiscoveryStatus;
export const selectAgentReported = (state: RootState) => state.projects.agentReported;
export const selectAgentDiscoveryErrors = (state: RootState) =>
  state.projects.agentDiscoveryErrors;
export const selectAgentRefreshStatus = (state: RootState) => state.projects.agentRefreshStatus;
export const selectPitrResolution = (state: RootState) => state.projects.pitr.resolution;
export const selectPitrStatus = (state: RootState) => state.projects.pitr.status;
export const selectPitrError = (state: RootState) => state.projects.pitr.error;
export const selectPitrRestoreJobId = (state: RootState) => state.projects.pitr.restoreJobId;
export const selectPitrRestoreStatus = (state: RootState) => state.projects.pitr.restoreStatus;
export const selectProjectJobs = (state: RootState) => state.projects.jobs;
export const selectProjectJobsStatus = (state: RootState) => state.projects.jobsStatus;
export const selectProjectJobsError = (state: RootState) => state.projects.jobsError;
export const selectAlertsSaveStatus = (state: RootState) => state.projects.alertsSaveStatus;
export const selectAlertsError = (state: RootState) => state.projects.alertsError;
export const selectMirrorSaveStatus = (state: RootState) => state.projects.mirrorSaveStatus;
export const selectMirrorError = (state: RootState) => state.projects.mirrorError;
