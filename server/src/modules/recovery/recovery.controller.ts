import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireUserId } from '../../shared/utils/require-user-id.js';
import { HttpError } from '../../shared/utils/http-error.js';
import type { ResticRunner } from '../backups/backups.boundaries.js';
import type { SchedulerQueue } from '../scheduler/scheduler.boundaries.js';
import type { ProjectHydrated } from '../backups/backups.model.js';
import { buildExportEnvelope, type StorageEnvelopeInput } from './recovery.export.js';
import { importEnvelope } from './recovery.import.js';
import {
  enqueueSelfBackup,
  runSelfBackup,
  type MongoDumpRunner,
} from './recovery.selfbackup.js';
import { SelfBackupRun } from './recovery.model.js';

export interface RecoveryControllerDeps {
  /** For POST /export — optional storage lookup for storage.host/user/sshKeyEnc. */
  loadStorage?: (userId: string) => Promise<StorageEnvelopeInput | null>;
  /** For POST /self-backup — synchronous run for tests, enqueue for prod. */
  queue?: SchedulerQueue;
  runNow?: () => Promise<unknown>;
  /** For import — used to probe repo reachability after import. */
  storageProbe?: (
    project: ProjectHydrated,
    password: string,
  ) => Promise<void>;
  /** Injected for direct-run tests. */
  resticRunner?: ResticRunner;
  mongoDump?: MongoDumpRunner;
}

let deps: RecoveryControllerDeps = {};

export function configureRecoveryController(next: RecoveryControllerDeps): void {
  deps = { ...deps, ...next };
}

export function resetRecoveryController(): void {
  deps = {};
}

export const exportConfig: RequestHandler = asyncHandler(async (req, res) => {
  const userId = requireUserId(req.user);
  const envelope = await buildExportEnvelope(userId, {
    loadStorage: deps.loadStorage,
  });
  const filename = `dockstash-export-${envelope.exportedAt.replace(/[:.]/g, '-')}.json`;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).json(envelope);
});

export const importConfig: RequestHandler = asyncHandler(async (req, res) => {
  const userId = requireUserId(req.user);
  const raw = req.body?.envelope ?? req.body;
  const result = await importEnvelope(userId, raw, {
    t: req.t,
    storageProbe: deps.storageProbe,
  });
  res.status(200).json({
    message: req.t
      ? req.t('recovery.success.imported')
      : 'recovery.success.imported',
    ...result,
  });
});

export const triggerSelfBackup: RequestHandler = asyncHandler(async (req, res) => {
  requireUserId(req.user);
  if (deps.runNow) {
    const result = await deps.runNow();
    res.status(202).json({ triggered: true, result });
    return;
  }
  if (deps.queue) {
    const result = await enqueueSelfBackup({ queue: deps.queue });
    res.status(202).json({ triggered: true, ...result });
    return;
  }
  if (deps.resticRunner && deps.mongoDump) {
    const result = await runSelfBackup({
      t: req.t,
      resticRunner: deps.resticRunner,
      mongoDump: deps.mongoDump,
    });
    res.status(202).json({ triggered: true, ...result });
    return;
  }
  throw HttpError.internal(
    req.t
      ? req.t('recovery.error.selfBackupFailed', { message: 'not configured' })
      : 'self-backup not configured',
  );
});

export const listSelfBackups: RequestHandler = asyncHandler(async (req, res) => {
  requireUserId(req.user);
  const runs = await SelfBackupRun.find({}).sort({ startedAt: -1 }).limit(50);
  res.status(200).json({
    runs: runs.map((r) => ({
      id: r._id.toString(),
      repo: r.repo,
      status: r.status,
      startedAt: r.startedAt ? new Date(r.startedAt).toISOString() : null,
      finishedAt: r.finishedAt ? new Date(r.finishedAt).toISOString() : null,
      error: r.error,
    })),
  });
});
