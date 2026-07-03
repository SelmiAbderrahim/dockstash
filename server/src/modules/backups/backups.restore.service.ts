import { HttpError } from '../../shared/utils/http-error.js';
import { logger } from '../../config/logger.js';
import type { TranslationVars } from '../../shared/i18n/index.js';
import { sendFailureAlert } from '../alerting/index.js';
import type { ProjectHydrated, VerifyStatus } from './backups.model.js';
import { isAllowedProjectPath } from './backups.paths.js';
import { loadOwnedProject } from './backups.service.js';
import type { ResticRunner } from './backups.boundaries.js';

export type Translator = (key: string, vars?: TranslationVars) => string;
const identityT: Translator = (key) => key;

/**
 * A restic snapshot id is either a short/long hex id or the alias `latest`.
 * Validate before it enters the restic argv so a value like `--flag` can never
 * be interpreted as an option (argument injection).
 */
const SNAPSHOT_ID_RE = /^([0-9a-f]{8,64}|latest)$/i;

export interface RestoreOptions {
  snapshotId: string;
  /**
   * true  → restore over the live project tree (`--target /` re-creates the
   *          original absolute paths). The client requires typed-confirm
   *          before ever sending this; the server still re-asserts the
   *          explicit boolean.
   * false → restore to a new location under the /var/www allowlist.
   */
  overwrite: boolean;
  targetPath?: string;
}

export interface RunRestoreDeps {
  t?: Translator;
  resticRunner: ResticRunner;
}

export interface RunRestoreResult {
  status: VerifyStatus;
  snapshotId: string;
  target: string;
}

/**
 * Restore a snapshot for an owned project. Default is restore-to-new-location
 * (Security page promise); `overwrite: true` restores the original absolute
 * paths in place. v1 restores files to disk — database dump artifacts land as
 * files and are loaded manually (per-engine restore adapters are follow-up).
 */
export async function runRestore(
  projectId: string,
  userId: string,
  opts: RestoreOptions,
  deps: RunRestoreDeps,
): Promise<RunRestoreResult> {
  const t = deps.t ?? identityT;
  if (!SNAPSHOT_ID_RE.test(opts.snapshotId)) {
    throw HttpError.badRequest(t('errors.badRequest'));
  }
  const project = await loadOwnedProject(projectId, userId, { t });

  let target: string;
  if (opts.overwrite) {
    // Restic snapshots store absolute paths; `--target /` puts them back.
    target = '/';
  } else {
    if (!opts.targetPath || !isAllowedProjectPath(opts.targetPath)) {
      throw HttpError.badRequest(
        t('backups.error.pathNotAllowed', { path: opts.targetPath ?? '' }),
      );
    }
    target = opts.targetPath;
  }

  try {
    await deps.resticRunner.restore(['restore', opts.snapshotId, '--target', target]);
    await markRestore(project, 'pass', '');
    return { status: 'pass', snapshotId: opts.snapshotId, target };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markRestore(project, 'fail', message);
    try {
      await sendFailureAlert({
        projectId: String(project._id),
        kind: 'restore',
        error: message,
      });
    } catch (alertErr) {
      logger.error({ err: alertErr }, 'restore failure alert emit failed');
    }
    throw HttpError.internal(t('backups.error.restoreFailed', { message }));
  }
}

async function markRestore(
  project: ProjectHydrated,
  status: VerifyStatus,
  detail: string,
): Promise<void> {
  project.lastRestoreAt = new Date();
  project.lastRestoreStatus = status;
  project.lastRestoreDetail = detail;
  await project.save();
}
