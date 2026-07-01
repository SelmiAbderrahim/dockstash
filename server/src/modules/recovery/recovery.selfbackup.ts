import type { Readable } from 'node:stream';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { DEFAULT_LOCALE, translate } from '../../shared/i18n/index.js';
import type { TranslationVars } from '../../shared/i18n/index.js';
import type { ResticRunner } from '../backups/backups.boundaries.js';
import type { SchedulerCron, SchedulerQueue } from '../scheduler/scheduler.boundaries.js';
import { SelfBackupRun, type SelfBackupRunHydrated } from './recovery.model.js';

export type Translator = (key: string, vars?: TranslationVars) => string;
const identityT: Translator = (key, vars) => translate(DEFAULT_LOCALE, key, vars);

export const SELF_BACKUP_CRON_ID = 'recovery.self-backup';

/**
 * Piped `mongodump --archive --oplog` (`--oplog` for consistency) — the archive
 * is a single stream we pipe into `restic backup --stdin`. Never a temp file.
 */
export interface MongoDumpRunner {
  dump(): Promise<Readable>;
}

export interface RunSelfBackupDeps {
  t?: Translator;
  resticRunner: ResticRunner;
  mongoDump: MongoDumpRunner;
  /** Reserved repo id; defaults to env.SELF_BACKUP_REPO. */
  repo?: string;
  /** Runs `restic init` once if the repo is fresh; tests can no-op. */
  ensureRepoInitialized?: (runner: ResticRunner) => Promise<void>;
}

export interface RunSelfBackupResult {
  runId: string;
  status: 'success' | 'failed';
  error?: string;
}

/**
 * Execute one self-backup pass. Streams `mongodump --archive --oplog` into
 * `restic backup --stdin` against the reserved repo. Persists a `SelfBackupRun`
 * marker regardless of outcome so operators can audit the schedule.
 *
 * Failure is atomic — the persisted row transitions from `running` directly to
 * `failed` and the archive stream is destroyed. No partial `success` is ever
 * written.
 */
export async function runSelfBackup(
  deps: RunSelfBackupDeps,
): Promise<RunSelfBackupResult> {
  const t = deps.t ?? identityT;
  const repo = deps.repo ?? env.SELF_BACKUP_REPO;
  const startedAt = new Date();
  const run: SelfBackupRunHydrated = await SelfBackupRun.create({
    repo,
    status: 'running',
    startedAt,
  });

  let dumpStream: Readable | null = null;
  try {
    if (deps.ensureRepoInitialized) {
      await deps.ensureRepoInitialized(deps.resticRunner);
    }
    dumpStream = await deps.mongoDump.dump();
    await deps.resticRunner.backup(
      ['backup', '--stdin', '--stdin-filename', 'dockstash-mongo.archive'],
      { stdin: dumpStream },
    );
    run.status = 'success';
    run.finishedAt = new Date();
    await run.save();
    return { runId: run._id.toString(), status: 'success' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, repo }, 'self-backup failed');
    if (dumpStream) {
      try {
        dumpStream.destroy();
      } catch {
        /* stream cleanup best-effort */
      }
    }
    run.status = 'failed';
    run.error = t('recovery.error.selfBackupFailed', { message });
    run.finishedAt = new Date();
    await run.save();
    return { runId: run._id.toString(), status: 'failed', error: message };
  }
}

/**
 * Reserved "owner" identifier for self-backup jobs enqueued on the shared
 * per-repo queue. Never matches a real Mongo `ObjectId` — the reserved repo id
 * is unique, so collisions with a user project's queue are impossible.
 */
export const SELF_BACKUP_OWNER = 'system:self-backup';

export interface EnqueueSelfBackupDeps {
  queue: SchedulerQueue;
  repo?: string;
}

/**
 * Enqueue a single self-backup job onto the per-repo BullMQ queue (prompt 05).
 * The queue's per-`projectId` serialization guarantees that even concurrent
 * cron ticks execute one at a time against the reserved repo.
 */
export async function enqueueSelfBackup(
  deps: EnqueueSelfBackupDeps,
): Promise<{ jobId: string }> {
  const repo = deps.repo ?? env.SELF_BACKUP_REPO;
  const job = await deps.queue.add({
    projectId: repo,
    owner: SELF_BACKUP_OWNER,
    // `kind: 'backup'` is only inspected by the shared dispatcher when the
    // projectId is a real Mongo id; a dedicated processor keyed off the
    // reserved repo id is what dispatches self-backup work.
    kind: 'backup',
  });
  return { jobId: job.id };
}

export interface RegisterSelfBackupCronDeps {
  cron: SchedulerCron;
  cronExpr?: string;
  enqueue: () => Promise<unknown>;
}

/**
 * Idempotent cron registration. `cron.register` replaces the entry in place,
 * so re-invoking on boot never stacks a second tick.
 */
export function registerSelfBackupCron(
  deps: RegisterSelfBackupCronDeps,
): void {
  const cronExpr = deps.cronExpr ?? env.SELF_BACKUP_CRON;
  deps.cron.register(SELF_BACKUP_CRON_ID, cronExpr, async () => {
    try {
      await deps.enqueue();
    } catch (err) {
      logger.error({ err }, 'self-backup cron enqueue failed');
    }
  });
}
