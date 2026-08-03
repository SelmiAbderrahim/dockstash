import { apiClient } from '@shared/api/client';
import type { AlertItem, HealthOverview } from './types';

interface AlertsResp {
  alerts: AlertItem[];
}

interface MarkReadResp {
  marked: number;
}

export const fetchOverviewRequest = () =>
  apiClient<HealthOverview>('/health/overview', { auth: true });

export const fetchAlertsRequest = (unreadOnly: boolean) =>
  apiClient<AlertsResp>(`/health/alerts${unreadOnly ? '?unread=true' : ''}`, {
    auth: true,
  }).then((r) => r.alerts);

export const markAlertsReadRequest = (ids?: string[]) =>
  apiClient<MarkReadResp>('/health/alerts/read', {
    method: 'POST',
    auth: true,
    body: ids ? { ids } : {},
  }).then((r) => r.marked);
