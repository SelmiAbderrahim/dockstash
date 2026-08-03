import { describe, expect, it, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { healthReducer } from './slice';
import { fetchAlerts, fetchHealthOverview, markAlertsRead } from './thunks';
import * as api from '../api';
import type { AlertItem, HealthOverview } from '../types';

vi.mock('../api', () => ({
  fetchOverviewRequest: vi.fn(),
  fetchAlertsRequest: vi.fn(),
  markAlertsReadRequest: vi.fn(),
}));

const mocked = vi.mocked(api);
const makeStore = () => configureStore({ reducer: { health: healthReducer } });

const overview: HealthOverview = { status: 'healthy', projects: [], unreadAlerts: 0 };
const alert: AlertItem = {
  id: 'a1',
  projectId: 'p1',
  projectName: 'my-project',
  kind: 'backup',
  severity: 'warning',
  error: 'boom',
  read: false,
  createdAt: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('health thunks', () => {
  it('fetchHealthOverview resolves with the overview', async () => {
    mocked.fetchOverviewRequest.mockResolvedValue(overview);
    const store = makeStore();
    const result = await store.dispatch(fetchHealthOverview());
    expect(fetchHealthOverview.fulfilled.match(result)).toBe(true);
    expect(result.payload).toEqual(overview);
  });

  it('fetchHealthOverview rejects with a message on failure', async () => {
    mocked.fetchOverviewRequest.mockRejectedValue(new Error('boom'));
    const store = makeStore();
    const result = await store.dispatch(fetchHealthOverview());
    expect(fetchHealthOverview.rejected.match(result)).toBe(true);
    expect(typeof result.payload).toBe('string');
  });

  it('fetchAlerts defaults to all alerts when called without an argument', async () => {
    mocked.fetchAlertsRequest.mockResolvedValue([alert]);
    const store = makeStore();
    const result = await store.dispatch(fetchAlerts());
    expect(fetchAlerts.fulfilled.match(result)).toBe(true);
    expect(mocked.fetchAlertsRequest).toHaveBeenCalledWith(false);
    expect(result.payload).toEqual([alert]);
  });

  it('fetchAlerts defaults unreadOnly to false when omitted from the argument', async () => {
    mocked.fetchAlertsRequest.mockResolvedValue([]);
    const store = makeStore();
    await store.dispatch(fetchAlerts({}));
    expect(mocked.fetchAlertsRequest).toHaveBeenCalledWith(false);
  });

  it('fetchAlerts passes unreadOnly through', async () => {
    mocked.fetchAlertsRequest.mockResolvedValue([]);
    const store = makeStore();
    await store.dispatch(fetchAlerts({ unreadOnly: true }));
    expect(mocked.fetchAlertsRequest).toHaveBeenCalledWith(true);
  });

  it('fetchAlerts rejects with a message on failure', async () => {
    mocked.fetchAlertsRequest.mockRejectedValue(new Error('boom'));
    const store = makeStore();
    const result = await store.dispatch(fetchAlerts());
    expect(fetchAlerts.rejected.match(result)).toBe(true);
    expect(typeof result.payload).toBe('string');
  });

  it('markAlertsRead resolves with ids and marked count', async () => {
    mocked.markAlertsReadRequest.mockResolvedValue(1);
    const store = makeStore();
    const result = await store.dispatch(markAlertsRead({ ids: ['a1'] }));
    expect(markAlertsRead.fulfilled.match(result)).toBe(true);
    expect(mocked.markAlertsReadRequest).toHaveBeenCalledWith(['a1']);
    expect(result.payload).toEqual({ ids: ['a1'], marked: 1 });
  });

  it('markAlertsRead resolves without ids (mark all)', async () => {
    mocked.markAlertsReadRequest.mockResolvedValue(3);
    const store = makeStore();
    const result = await store.dispatch(markAlertsRead());
    expect(markAlertsRead.fulfilled.match(result)).toBe(true);
    expect(mocked.markAlertsReadRequest).toHaveBeenCalledWith(undefined);
    expect(result.payload).toEqual({ ids: undefined, marked: 3 });
  });

  it('markAlertsRead rejects with a message on failure', async () => {
    mocked.markAlertsReadRequest.mockRejectedValue(new Error('boom'));
    const store = makeStore();
    const result = await store.dispatch(markAlertsRead({}));
    expect(markAlertsRead.rejected.match(result)).toBe(true);
    expect(typeof result.payload).toBe('string');
  });
});
