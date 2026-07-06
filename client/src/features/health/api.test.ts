import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as client from '@shared/api/client';
import { fetchAlertsRequest, fetchOverviewRequest, markAlertsReadRequest } from './api';

vi.mock('@shared/api/client', () => ({ apiClient: vi.fn() }));
const apiClient = vi.mocked(client.apiClient);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('health api wrappers', () => {
  it('fetchOverviewRequest fetches the overview', async () => {
    const overview = { status: 'healthy', projects: [], unreadAlerts: 0 };
    apiClient.mockResolvedValue(overview as never);
    const result = await fetchOverviewRequest();
    expect(apiClient).toHaveBeenCalledWith('/health/overview', { auth: true });
    expect(result).toBe(overview);
  });

  it('fetchAlertsRequest fetches all alerts and unwraps them', async () => {
    const alerts = [{ id: 'a1' }];
    apiClient.mockResolvedValue({ alerts } as never);
    const result = await fetchAlertsRequest(false);
    expect(apiClient).toHaveBeenCalledWith('/health/alerts', { auth: true });
    expect(result).toBe(alerts);
  });

  it('fetchAlertsRequest appends ?unread=true when unreadOnly', async () => {
    apiClient.mockResolvedValue({ alerts: [] } as never);
    await fetchAlertsRequest(true);
    expect(apiClient).toHaveBeenCalledWith('/health/alerts?unread=true', { auth: true });
  });

  it('markAlertsReadRequest posts ids and unwraps marked', async () => {
    apiClient.mockResolvedValue({ marked: 2 } as never);
    const result = await markAlertsReadRequest(['a1', 'a2']);
    expect(apiClient).toHaveBeenCalledWith('/health/alerts/read', {
      method: 'POST',
      auth: true,
      body: { ids: ['a1', 'a2'] },
    });
    expect(result).toBe(2);
  });

  it('markAlertsReadRequest posts an empty body when no ids given', async () => {
    apiClient.mockResolvedValue({ marked: 5 } as never);
    const result = await markAlertsReadRequest();
    expect(apiClient).toHaveBeenCalledWith('/health/alerts/read', {
      method: 'POST',
      auth: true,
      body: {},
    });
    expect(result).toBe(5);
  });
});
