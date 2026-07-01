import type { ResticRunner } from '../backups/backups.boundaries.js';
import type { JobKind } from './scheduler.model.js';

export interface RetentionPolicy {
  keepDaily: number;
  keepWeekly: number;
  keepMonthly: number;
}

export interface JobData {
  projectId: string;
  owner: string;
  kind: JobKind;
  retention?: RetentionPolicy;
  scheduleId?: string;
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

/**
 * Placeholder entitlement check. Prompt 07 (`plans.ts`) swaps in the real check
 * (schedule frequency + project cap). Always allow for now.
 */
export interface EntitlementChecker {
  canEnqueue(owner: string, kind: JobKind): Promise<boolean>;
}

export interface LogEmitter {
  log(jobId: string, line: string): void;
  done(jobId: string, ok: boolean, detail?: string): void;
}

export interface AlertHook {
  onFailed(job: Job, err: Error): Promise<void>;
}
