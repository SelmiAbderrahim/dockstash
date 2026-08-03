import { describe, expect, it } from 'vitest';
import type { RootState } from '@app/store';
import { healthReducer, clearHealthError, type HealthState } from './slice';
import { fetchAlerts, fetchHealthOverview, markAlertsRead } from './thunks';
import {
  selectAlerts,
  selectAlertsStatus,
  selectHealthError,
  selectHealthOverview,
  selectHealthStatus,
  selectMarkStatus,
  selectUnreadAlertCount,
} from './selectors';
import type { AlertItem, HealthOverview } from '../types';

const initial = () => healthReducer(undefined, { type: 'unknown' });

const overview = (over: Partial<HealthOverview> = {}): HealthOverview => ({
  status: 'healthy',
  projects: [],
  unreadAlerts: 2,
  ...over,
});

const alert = (over: Partial<AlertItem> = {}): AlertItem => ({
  id: 'a1',
  projectId: 'p1',
  projectName: 'my-project',
  kind: 'backup',
  severity: 'warning',
  error: 'boom',
  read: false,
  createdAt: '2024-01-01T00:00:00Z',
  ...over,
});

describe('health slice', () => {
  it('fetchHealthOverview pending → fulfilled stores the overview', () => {
    let s = healthReducer(initial(), { type: fetchHealthOverview.pending.type });
    expect(s.status).toBe('loading');
    expect(s.error).toBeNull();
    s = healthReducer(s, { type: fetchHealthOverview.fulfilled.type, payload: overview() });
    expect(s.status).toBe('succeeded');
    expect(s.overview?.unreadAlerts).toBe(2);
  });

  it('fetchHealthOverview.rejected sets error from payload and falls back', () => {
    let s = healthReducer(initial(), { type: fetchHealthOverview.rejected.type, payload: 'nope' });
    expect(s.status).toBe('failed');
    expect(s.error).toBe('nope');
    s = healthReducer(initial(), { type: fetchHealthOverview.rejected.type, payload: undefined });
    expect(s.error).toBe('Could not load health overview.');
  });

  it('fetchAlerts pending → fulfilled stores the alerts', () => {
    let s = healthReducer(initial(), { type: fetchAlerts.pending.type });
    expect(s.alertsStatus).toBe('loading');
    s = healthReducer(s, { type: fetchAlerts.fulfilled.type, payload: [alert()] });
    expect(s.alertsStatus).toBe('succeeded');
    expect(s.alerts).toHaveLength(1);
  });

  it('fetchAlerts.rejected sets error from payload and falls back', () => {
    let s = healthReducer(initial(), { type: fetchAlerts.rejected.type, payload: 'nope' });
    expect(s.alertsStatus).toBe('failed');
    expect(s.error).toBe('nope');
    s = healthReducer(initial(), { type: fetchAlerts.rejected.type, payload: undefined });
    expect(s.error).toBe('Could not load alerts.');
  });

  it('markAlertsRead.pending sets markStatus loading', () => {
    const s = healthReducer(initial(), { type: markAlertsRead.pending.type });
    expect(s.markStatus).toBe('loading');
  });

  it('markAlertsRead.fulfilled with ids marks only those alerts and decrements the counter', () => {
    const start: HealthState = {
      ...initial(),
      overview: overview({ unreadAlerts: 5 }),
      alerts: [
        alert({ id: 'a1', read: false }),
        alert({ id: 'a2', read: false }),
        alert({ id: 'a3', read: true }),
      ],
    };
    const s = healthReducer(start, {
      type: markAlertsRead.fulfilled.type,
      payload: { ids: ['a1', 'a3'], marked: 1 },
    });
    expect(s.markStatus).toBe('succeeded');
    expect(s.alerts.map((a) => a.read)).toEqual([true, false, true]);
    // Only a1 was newly read (a3 was already read, a2 not targeted).
    expect(s.overview?.unreadAlerts).toBe(4);
  });

  it('markAlertsRead.fulfilled without ids marks everything and zeroes the counter', () => {
    const start: HealthState = {
      ...initial(),
      overview: overview({ unreadAlerts: 2 }),
      alerts: [alert({ id: 'a1', read: false }), alert({ id: 'a2', read: true })],
    };
    const s = healthReducer(start, {
      type: markAlertsRead.fulfilled.type,
      payload: { ids: undefined, marked: 1 },
    });
    expect(s.alerts.every((a) => a.read)).toBe(true);
    expect(s.overview?.unreadAlerts).toBe(0);
  });

  it('markAlertsRead.fulfilled clamps the unread counter at zero', () => {
    const start: HealthState = {
      ...initial(),
      overview: overview({ unreadAlerts: 0 }),
      alerts: [alert({ id: 'a1', read: false })],
    };
    const s = healthReducer(start, {
      type: markAlertsRead.fulfilled.type,
      payload: { ids: ['a1'], marked: 1 },
    });
    expect(s.overview?.unreadAlerts).toBe(0);
  });

  it('markAlertsRead.fulfilled tolerates a missing overview', () => {
    const start: HealthState = { ...initial(), alerts: [alert({ id: 'a1', read: false })] };
    const s = healthReducer(start, {
      type: markAlertsRead.fulfilled.type,
      payload: { ids: undefined, marked: 1 },
    });
    expect(s.overview).toBeNull();
    expect(s.alerts[0]?.read).toBe(true);
  });

  it('markAlertsRead.rejected sets error from payload and falls back', () => {
    let s = healthReducer(initial(), { type: markAlertsRead.rejected.type, payload: 'nope' });
    expect(s.markStatus).toBe('failed');
    expect(s.error).toBe('nope');
    s = healthReducer(initial(), { type: markAlertsRead.rejected.type, payload: undefined });
    expect(s.error).toBe('Could not mark alerts as read.');
  });

  it('clearHealthError resets the error', () => {
    let s = healthReducer(initial(), { type: fetchAlerts.rejected.type, payload: 'x' });
    s = healthReducer(s, clearHealthError());
    expect(s.error).toBeNull();
  });
});

describe('health selectors', () => {
  const asRoot = (health: HealthState) => ({ health }) as unknown as RootState;

  it('read their slices of state', () => {
    const health: HealthState = {
      ...initial(),
      overview: overview({ unreadAlerts: 3 }),
      alerts: [alert()],
      status: 'succeeded',
      alertsStatus: 'loading',
      markStatus: 'failed',
      error: 'oops',
    };
    const state = asRoot(health);
    expect(selectHealthOverview(state)).toBe(health.overview);
    expect(selectHealthStatus(state)).toBe('succeeded');
    expect(selectAlerts(state)).toBe(health.alerts);
    expect(selectAlertsStatus(state)).toBe('loading');
    expect(selectMarkStatus(state)).toBe('failed');
    expect(selectHealthError(state)).toBe('oops');
    expect(selectUnreadAlertCount(state)).toBe(3);
  });

  it('selectUnreadAlertCount falls back to 0 without an overview', () => {
    expect(selectUnreadAlertCount(asRoot(initial()))).toBe(0);
  });
});
