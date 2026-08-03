import { describe, expect, it } from 'vitest';
import { snapshotsReducer, clearRestoreJob, clearError, setActiveRestoreJob } from './slice';
import { fetchSnapshots, restore } from './thunks';

const initial = () => snapshotsReducer(undefined, { type: 'unknown' });

describe('snapshots slice', () => {
  it('fetchSnapshots stores per-project', () => {
    let s = snapshotsReducer(initial(), { type: fetchSnapshots.pending.type });
    expect(s.status).toBe('loading');
    s = snapshotsReducer(s, {
      type: fetchSnapshots.fulfilled.type,
      payload: {
        projectId: 'p1',
        snapshots: [{ id: 's1', projectId: 'p1', time: '', sizeBytes: 100 }],
      },
    });
    expect(s.byProject['p1']).toHaveLength(1);
  });

  it('restore.fulfilled tracks active job; clearRestoreJob resets', () => {
    let s = snapshotsReducer(initial(), {
      type: restore.fulfilled.type,
      payload: { projectId: 'p1', jobId: 'j-1' },
    });
    expect(s.activeRestoreJobId).toBe('j-1');
    s = snapshotsReducer(s, clearRestoreJob());
    expect(s.activeRestoreJobId).toBeNull();
  });

  it('setActiveRestoreJob explicit set', () => {
    const s = snapshotsReducer(initial(), setActiveRestoreJob('j-9'));
    expect(s.activeRestoreJobId).toBe('j-9');
  });

  it('fetchSnapshots.rejected sets error from payload', () => {
    const s = snapshotsReducer(initial(), {
      type: fetchSnapshots.rejected.type,
      payload: 'nope',
    });
    expect(s.status).toBe('failed');
    expect(s.error).toBe('nope');
  });

  it('fetchSnapshots.rejected falls back to a default message', () => {
    const s = snapshotsReducer(initial(), {
      type: fetchSnapshots.rejected.type,
      payload: undefined,
    });
    expect(s.error).toBe('Could not load snapshots.');
  });

  it('restore.rejected sets error from payload and falls back', () => {
    let s = snapshotsReducer(initial(), {
      type: restore.rejected.type,
      payload: 'restore-fail',
    });
    expect(s.error).toBe('restore-fail');
    s = snapshotsReducer(initial(), { type: restore.rejected.type, payload: undefined });
    expect(s.error).toBe('Could not start restore.');
  });

  it('clearError resets the error', () => {
    let s = snapshotsReducer(initial(), {
      type: fetchSnapshots.rejected.type,
      payload: 'x',
    });
    s = snapshotsReducer(s, clearError());
    expect(s.error).toBeNull();
  });
});
