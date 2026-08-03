import type { RootState } from '@app/store';

export const selectSnapshotsForProject = (projectId: string) => (state: RootState) =>
  state.snapshots.byProject[projectId] ?? [];
export const selectSnapshotsStatus = (state: RootState) => state.snapshots.status;
export const selectSnapshotsError = (state: RootState) => state.snapshots.error;
export const selectActiveRestoreJobId = (state: RootState) => state.snapshots.activeRestoreJobId;
