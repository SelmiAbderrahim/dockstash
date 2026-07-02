import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as client from '@shared/api/client';
import { listSnapshotsRequest, restoreRequest } from './api';

vi.mock('@shared/api/client', () => ({ apiClient: vi.fn() }));
const apiClient = vi.mocked(client.apiClient);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('snapshots api wrappers', () => {
  it('listSnapshotsRequest fetches and unwraps snapshots', async () => {
    const snapshots = [{ id: 's1', projectId: 'p1', time: '', sizeBytes: 10 }];
    apiClient.mockResolvedValue({ snapshots } as never);
    const result = await listSnapshotsRequest('p1');
    expect(apiClient).toHaveBeenCalledWith('/backups/p1/snapshots', { auth: true });
    expect(result).toBe(snapshots);
  });

  it('restoreRequest posts the enqueue body and unwraps jobId', async () => {
    apiClient.mockResolvedValue({ job: { id: 'job-9', kind: 'restore' } } as never);
    const result = await restoreRequest({
      projectId: 'p1',
      snapshotId: 's1',
      overwrite: false,
      targetPath: '/var/restores/x',
    });
    expect(apiClient).toHaveBeenCalledWith('/scheduler/enqueue', {
      method: 'POST',
      auth: true,
      body: {
        projectId: 'p1',
        kind: 'restore',
        snapshotId: 's1',
        overwrite: false,
        targetPath: '/var/restores/x',
      },
    });
    expect(result).toBe('job-9');
  });
});
