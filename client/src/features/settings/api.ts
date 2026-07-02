import { apiClient, ApiError } from '@shared/api/client';
import type { RecoveryCodesResult, RetentionPolicy, SelfBackupRun, StorageConfig } from './types';

interface StorageResp {
  storage: StorageConfig;
}
interface RetentionResp {
  retention: RetentionPolicy;
}
interface OkResp {
  ok: true;
}
interface SelfBackupRunsResp {
  runs: SelfBackupRun[];
}
interface TriggeredResp {
  triggered: boolean;
}

export const fetchStorageRequest = async (): Promise<StorageConfig> => {
  try {
    const r = await apiClient<StorageResp>('/settings/storage', { auth: true });
    return r.storage;
  } catch (err) {
    // If the backend endpoint is not yet mounted, treat as unconfigured
    if (err instanceof ApiError && err.status === 404) {
      return { host: '', user: '', port: 22, configured: false };
    }
    throw err;
  }
};

export const saveStorageRequest = (input: {
  host: string;
  user: string;
  port: number;
  privateKey: string;
}): Promise<StorageConfig> =>
  apiClient<StorageResp>('/settings/storage', {
    method: 'PUT',
    auth: true,
    body: input,
  }).then((r) => r.storage);

export const testStorageRequest = (): Promise<OkResp> =>
  apiClient<OkResp>('/settings/storage/test', { method: 'POST', auth: true });

export const fetchRetentionRequest = async (): Promise<RetentionPolicy> => {
  try {
    const r = await apiClient<RetentionResp>('/settings/retention', { auth: true });
    return r.retention;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { keepDaily: 7, keepWeekly: 4, keepMonthly: 6 };
    }
    throw err;
  }
};

export const saveRetentionRequest = (input: RetentionPolicy): Promise<RetentionPolicy> =>
  apiClient<RetentionResp>('/settings/retention', {
    method: 'PUT',
    auth: true,
    body: input,
  }).then((r) => r.retention);

export const savePasswordRequest = (password: string): Promise<OkResp> =>
  apiClient<OkResp>('/settings/encryption-password', {
    method: 'PUT',
    auth: true,
    body: { password },
  });

export const exportConfigRequest = (): Promise<Record<string, unknown>> =>
  apiClient<Record<string, unknown>>('/recovery/export', { method: 'POST', auth: true });

/**
 * Turn the export envelope into a browser download named
 * `dockstash-export-<iso-date>.json`.
 */
export const downloadJsonExport = (data: unknown, now: Date = new Date()): void => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `dockstash-export-${now.toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const generateRecoveryCodesRequest = (): Promise<RecoveryCodesResult> =>
  apiClient<RecoveryCodesResult>('/recovery/recovery-codes', { method: 'POST', auth: true });

export const triggerSelfBackupRequest = (): Promise<TriggeredResp> =>
  apiClient<TriggeredResp>('/recovery/self-backup', { method: 'POST', auth: true });

export const fetchSelfBackupRunsRequest = (): Promise<SelfBackupRun[]> =>
  apiClient<SelfBackupRunsResp>('/recovery/self-backup', { auth: true }).then((r) => r.runs);
