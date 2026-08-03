import type { RootState } from '@app/store';

export const selectHealthOverview = (state: RootState) => state.health.overview;
export const selectHealthStatus = (state: RootState) => state.health.status;
export const selectAlerts = (state: RootState) => state.health.alerts;
export const selectAlertsStatus = (state: RootState) => state.health.alertsStatus;
export const selectMarkStatus = (state: RootState) => state.health.markStatus;
export const selectHealthError = (state: RootState) => state.health.error;
export const selectUnreadAlertCount = (state: RootState) =>
  state.health.overview?.unreadAlerts ?? 0;
