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
