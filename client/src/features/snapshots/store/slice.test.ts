import { describe, expect, it } from 'vitest';
import { snapshotsReducer, clearRestoreJob, setActiveRestoreJob } from './slice';
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
});
