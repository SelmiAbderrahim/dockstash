import { describe, expect, it, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { snapshotsReducer } from './slice';
import { fetchSnapshots, restore } from './thunks';
import * as api from '../api';

vi.mock('../api', () => ({
  listSnapshotsRequest: vi.fn(),
  restoreRequest: vi.fn(),
}));

const mocked = vi.mocked(api);
const makeStore = () => configureStore({ reducer: { snapshots: snapshotsReducer } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('snapshots thunks', () => {
  it('fetchSnapshots resolves with the project snapshots', async () => {
    const snapshots = [{ id: 's1', projectId: 'p1', time: '', sizeBytes: 1 }];
    mocked.listSnapshotsRequest.mockResolvedValue(snapshots);
    const store = makeStore();
    const result = await store.dispatch(fetchSnapshots({ projectId: 'p1' }));
    expect(fetchSnapshots.fulfilled.match(result)).toBe(true);
    expect(result.payload).toEqual({ projectId: 'p1', snapshots });
  });

  it('fetchSnapshots rejects with a message on failure', async () => {
    mocked.listSnapshotsRequest.mockRejectedValue(new Error('boom'));
    const store = makeStore();
    const result = await store.dispatch(fetchSnapshots({ projectId: 'p1' }));
    expect(fetchSnapshots.rejected.match(result)).toBe(true);
    expect(typeof result.payload).toBe('string');
  });

  it('restore resolves with the job id', async () => {
    mocked.restoreRequest.mockResolvedValue('job-1');
    const store = makeStore();
    const result = await store.dispatch(
      restore({ projectId: 'p1', snapshotId: 's1', overwrite: true }),
    );
    expect(restore.fulfilled.match(result)).toBe(true);
    expect(result.payload).toEqual({ projectId: 'p1', jobId: 'job-1' });
  });

  it('restore rejects with a message on failure', async () => {
    mocked.restoreRequest.mockRejectedValue(new Error('boom'));
    const store = makeStore();
    const result = await store.dispatch(
      restore({ projectId: 'p1', snapshotId: 's1', overwrite: true }),
    );
    expect(restore.rejected.match(result)).toBe(true);
    expect(typeof result.payload).toBe('string');
  });
});
