import { DEFAULT_LOCALE, translate } from '../../shared/i18n/index.js';
import type { TranslationVars } from '../../shared/i18n/index.js';
import { runBackup } from '../backups/backups.service.js';
import {
  runResticCheck,
  runRestoreDrill,
} from '../backups/backups.verify.service.js';
import type {
  DockerClient,
  ScratchWorkspace,
  FileDiffer,
  DbDiffer,
  DiskSpaceProbe,
} from '../backups/backups.boundaries.js';
import type { ComposeService } from '../backups/backups.adapters.js';
import { runPrune } from './scheduler.prune.service.js';
import type {
  AlertHook,
  Job,
  LogEmitter,
  ResticRunnerExt,
  SchedulerQueue,
} from './scheduler.boundaries.js';
import { recoverStaleLockIfOrphaned } from './scheduler.lock.js';
import { Schedule, type ScheduleStatus } from './scheduler.model.js';

export type Translator = (key: string, vars?: TranslationVars) => string;
const identityT: Translator = (key, vars) => translate(DEFAULT_LOCALE, key, vars);

export interface DispatchDeps {
  t?: Translator;
  resticRunner: ResticRunnerExt;
  dockerClient?: DockerClient;
  scratch?: ScratchWorkspace;
  fileDiff?: FileDiffer;
  dbDiff?: DbDiffer;
  diskProbe?: DiskSpaceProbe;
  composeServices?: Record<string, ComposeService>;
}

/**
 * Dispatch a single job by kind. This is the CORE of the worker — it invokes
 * the appropriate service. `backup` NEVER calls `runPrune` — prune is its
 * own kind and its own job.
 */
export async function dispatchJob(job: Job, deps: DispatchDeps): Promise<void> {
  const t = deps.t ?? identityT;
  const { projectId, owner, kind, retention } = job.data;
  switch (kind) {
    case 'backup': {
      if (!deps.dockerClient) {
        throw new Error('dispatchJob: backup requires dockerClient');
      }
      await runBackup(projectId, owner, {
        t,
        resticRunner: deps.resticRunner,
        dockerClient: deps.dockerClient,
        diskProbe: deps.diskProbe,
        composeServices: deps.composeServices,
      });
      return;
    }
    case 'check': {
      await runResticCheck(projectId, owner, { t, resticRunner: deps.resticRunner });
      return;
    }
    case 'drill': {
      if (!deps.scratch || !deps.fileDiff || !deps.dbDiff) {
        throw new Error('dispatchJob: drill requires scratch/fileDiff/dbDiff');
      }
      await runRestoreDrill(projectId, owner, {
        t,
        resticRunner: deps.resticRunner,
        scratch: deps.scratch,
        fileDiff: deps.fileDiff,
        dbDiff: deps.dbDiff,
      });
      return;
    }
    case 'prune': {
      if (!retention) {
        throw new Error('dispatchJob: prune requires retention policy');
      }
      await runPrune(projectId, owner, retention, {
        t,
        resticRunner: deps.resticRunner,
      });
      return;
    }
  }
}

export interface ProcessJobDeps extends DispatchDeps {
  queue: SchedulerQueue;
  logs?: LogEmitter;
  alert?: AlertHook;
  maxAttempts?: number;
  baseBackoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

async function persistStatus(
  scheduleId: string | undefined,
  status: ScheduleStatus,
): Promise<void> {
  if (!scheduleId) return;
  try {
    await Schedule.findByIdAndUpdate(scheduleId, { lastRunStatus: status });
  } catch {
    // model may not be connected in unit tests without mongo — best effort
  }
}

/**
 * Process a job with retry + exponential backoff. On each retry, attempt
 * stale-lock recovery. On final failure, mark the schedule failed, emit a
 * `failed` terminal event, and call the alert hook.
 */
export async function processJob(job: Job, deps: ProcessJobDeps): Promise<void> {
  const maxAttempts = deps.maxAttempts ?? 3;
  const baseBackoffMs = deps.baseBackoffMs ?? 200;
  const sleep = deps.sleep ?? defaultSleep;

  await persistStatus(job.data.scheduleId, 'running');

  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    job.attempts = attempt;
    try {
      if (attempt > 1) {
        await recoverStaleLockIfOrphaned(job, {
          queue: deps.queue,
          resticRunner: deps.resticRunner,
        });
      }
      await dispatchJob(job, deps);
      await persistStatus(job.data.scheduleId, 'success');
      deps.logs?.done(job.id, true);
      return;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts) {
        const backoff = baseBackoffMs * 2 ** (attempt - 1);
        await sleep(backoff);
        continue;
      }
      await persistStatus(job.data.scheduleId, 'failed');
      deps.logs?.done(job.id, false, lastErr.message);
      if (deps.alert) {
        try {
          await deps.alert.onFailed(job, lastErr);
        } catch {
          // alert transport is best-effort; never mask the job failure
        }
      }
      throw lastErr;
    }
  }
  // unreachable — loop always returns or throws
  /* c8 ignore next */
  throw lastErr ?? new Error('processJob: exhausted with no error');
}
