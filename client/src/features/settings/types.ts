export interface StorageConfig {
  host: string;
  user: string;
  port: number;
  keyFingerprint?: string;
  configured: boolean;
}

export interface RetentionPolicy {
  keepDaily: number;
  keepWeekly: number;
  keepMonthly: number;
}

export interface RecoveryCodesResult {
  message: string;
  codes: string[];
}

export interface SelfBackupRun {
  id: string;
  repo: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string;
}
