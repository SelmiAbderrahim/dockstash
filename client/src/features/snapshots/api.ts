import { apiClient } from '@shared/api/client';
import type { RestoreOptions, Snapshot } from './types';

interface SnapshotsResp {
  snapshots: Snapshot[];
}

interface EnqueueResp {
  jobId: string;
}

export const listSnapshotsRequest = (projectId: string) =>
  apiClient<SnapshotsResp>(`/backups/${projectId}/snapshots`, { auth: true }).then(
    (r) => r.snapshots,
  );

export const restoreRequest = (opts: RestoreOptions) =>
  apiClient<EnqueueResp>('/scheduler/enqueue', {
    method: 'POST',
    auth: true,
    body: {
      projectId: opts.projectId,
      kind: 'restore',
      snapshotId: opts.snapshotId,
      overwrite: opts.overwrite,
      targetPath: opts.targetPath,
    },
  }).then((r) => r.jobId);
