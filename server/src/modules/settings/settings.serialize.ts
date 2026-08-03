import type { StorageSettingsHydrated } from './settings.model.js';

export interface SerializedStorage {
  host: string;
  user: string;
  port: number;
  keyFingerprint?: string;
  configured: boolean;
  passwordSet: boolean;
}

export interface SerializedRetention {
  keepDaily: number;
  keepWeekly: number;
  keepMonthly: number;
}

export const DEFAULT_RETENTION: SerializedRetention = {
  keepDaily: 7,
  keepWeekly: 4,
  keepMonthly: 6,
};

/** A settings row counts as configured once host, user and key are present. */
export function isStorageConfigured(settings: StorageSettingsHydrated): boolean {
  return Boolean(settings.host && settings.user && settings.sshKeyEnc);
}

export function serializeStorage(
  settings: StorageSettingsHydrated | null,
): SerializedStorage {
  if (!settings) {
    return { host: '', user: '', port: 22, configured: false, passwordSet: false };
  }
  const out: SerializedStorage = {
    host: settings.host,
    user: settings.user,
    port: settings.port,
    configured: isStorageConfigured(settings),
    passwordSet: Boolean(settings.defaultRepoPasswordEnc),
  };
  if (settings.hostKeyFingerprint) {
    out.keyFingerprint = settings.hostKeyFingerprint;
  }
  return out;
}

export function serializeRetention(
  settings: StorageSettingsHydrated | null,
): SerializedRetention {
  if (!settings) return { ...DEFAULT_RETENTION };
  return {
    keepDaily: settings.retention.keepDaily,
    keepWeekly: settings.retention.keepWeekly,
    keepMonthly: settings.retention.keepMonthly,
  };
}
