import type { ResticRunner } from '../backups/backups.boundaries.js';
import type { JobKind } from './scheduler.model.js';

export interface RetentionPolicy {
  keepDaily: number;
  keepWeekly: number;
  keepMonthly: number;
  /** Continuous-backup keeps; 0/undefined omits the flag from `restic forget`. */
  keepHourly?: number;
  keepLast?: number;
}

/** One-shot restore parameters carried on ad-hoc `restore` jobs. */
export interface RestoreJobPayload {
  snapshotId: string;
  /** true = restore over the live project path; false = restore to targetPath. */
  overwrite: boolean;
  targetPath?: string;
}

export interface JobData {
  projectId: string;
  owner: string;
  kind: JobKind;
  retention?: RetentionPolicy;
  scheduleId?: string;
  payload?: RestoreJobPayload;
}

export interface Job {
  id: string;
  data: JobData;
  attempts: number;
}

export interface SchedulerQueue {
  add(data: JobData): Promise<Job>;
  activeCountForProject(projectId: string): Promise<number>;
  waitIdle(): Promise<void>;
  close(): Promise<void>;
}

export interface SchedulerCron {
  register(id: string, cronExpr: string, run: () => Promise<void>): void;
  unregister(id: string): void;
  list(): string[];
  clear(): void;
}

/** Restic superset used by the scheduler — adds `unlock` and `forget`. */
export interface ResticRunnerExt extends ResticRunner {
  unlock(): Promise<void>;
  forget(args: string[]): Promise<void>;
}

export interface LogEmitter {
  log(jobId: string, line: string): void;
  done(jobId: string, ok: boolean, detail?: string): void;
}

export interface AlertHook {
  onFailed(job: Job, err: Error): Promise<void>;
}

/**
 * Runtime marker so this boundary module carries at least one executable
 * export. The declarations above are type-only (erased at build time); the
 * marker keeps the module loadable and covered, mirroring how
 * `backups.boundaries.ts` exposes `MIN_FREE_BYTES_DEFAULT`.
 */
export const SCHEDULER_BOUNDARY_VERSION = 1;
