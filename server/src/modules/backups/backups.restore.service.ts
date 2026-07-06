import { HttpError } from '../../shared/utils/http-error.js';
import { logger } from '../../config/logger.js';
import type { TranslationVars } from '../../shared/i18n/index.js';
import { sendFailureAlert } from '../alerting/index.js';
import type { ProjectHydrated, VerifyStatus } from './backups.model.js';
import { isAllowedProjectPath } from './backups.paths.js';
import { loadOwnedProject } from './backups.service.js';
import type {
  DockerClient,
  ResticRunner,
  ResticSnapshotRecord,
} from './backups.boundaries.js';
import type { ComposeService } from './backups.adapters.js';
import {
  buildDbRestorePlan,
  classifySnapshot,
  performDbRestore,
  UnsupportedRestoreError,
  type PlanDatabase,
} from './backups.restore-plan.js';

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
   * true  → restore in place. Path snapshots re-create their original absolute
   *          paths (`--target /`); DB dump snapshots are streamed back into
   *          the running database container (per-engine restore plan). The
   *          client requires typed-confirm before ever sending this; the
   *          server still re-asserts the explicit boolean.
   * false → restore to a new location under the /var/www allowlist (file
   *          materialization for every snapshot kind).
   */
  overwrite: boolean;
  targetPath?: string;
}

export interface RunRestoreDeps {
  t?: Translator;
  resticRunner: ResticRunner;
  /** Required only for overwrite restores of DB dump snapshots. */
  dockerClient?: DockerClient;
}

export interface RunRestoreResult {
  status: VerifyStatus;
  snapshotId: string;
  /** Filesystem target, or the database container for a DB restore. */
  target: string;
}

/** `latest` → newest by time; otherwise short-id or full-id prefix match. */
export function resolveSnapshot(
  snapshots: ResticSnapshotRecord[],
  snapshotId: string,
): ResticSnapshotRecord | undefined {
  if (snapshotId.toLowerCase() === 'latest') {
    return [...snapshots].sort((a, b) => a.time.localeCompare(b.time)).at(-1);
  }
  const wanted = snapshotId.toLowerCase();
  return snapshots.find(
    (s) =>
      s.short_id.toLowerCase() === wanted || s.id.toLowerCase().startsWith(wanted),
  );
}

/**
 * Restore a snapshot for an owned project. Default is restore-to-new-location
 * (Security page promise); `overwrite: true` restores in place — path
 * snapshots to their original absolute paths, DB dump snapshots back into the
 * running database container via the per-engine restore plan.
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

  if (!opts.overwrite && (!opts.targetPath || !isAllowedProjectPath(opts.targetPath))) {
    throw HttpError.badRequest(
      t('backups.error.pathNotAllowed', { path: opts.targetPath ?? '' }),
    );
  }

  try {
    const target = opts.overwrite
      ? await runOverwriteRestore(project, opts.snapshotId, { t, ...deps })
      : await runFileRestore(opts.snapshotId, opts.targetPath as string, deps);
    await markRestore(project, 'pass', '');
    return { status: 'pass', snapshotId: opts.snapshotId, target };
  } catch (err) {
    // User/plan errors (unknown snapshot, unsupported engine, stopped
    // container, out-of-allowlist paths) are 4xx: surface them directly
    // without stamping a failure or emitting an alert email.
    if (err instanceof HttpError && err.status < 500) throw err;
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

/** Non-overwrite: file materialization for every snapshot kind. */
async function runFileRestore(
  snapshotId: string,
  targetPath: string,
  deps: RunRestoreDeps,
): Promise<string> {
  await deps.resticRunner.restore(['restore', snapshotId, '--target', targetPath]);
  return targetPath;
}

async function runOverwriteRestore(
  project: ProjectHydrated,
  snapshotId: string,
  deps: RunRestoreDeps & { t: Translator },
): Promise<string> {
  const { t } = deps;
  const snapshots = await deps.resticRunner.snapshotsDetailed();
  const snapshot = resolveSnapshot(snapshots, snapshotId);
  if (!snapshot) {
    throw HttpError.badRequest(t('backups.error.restoreSnapshotNotFound', { snapshotId }));
  }

  const databases = project.plan.databases as unknown as PlanDatabase[];
  const cls = classifySnapshot(snapshot, databases);

  if (cls.kind === 'paths') {
    // Pre-flight: every recorded path must sit inside the allowlist, so a
    // foreign or artifact snapshot can never make `restic restore --target /`
    // write outside the project tree (the old failure mode: a DB artifact like
    // /redis-dump.rdb hitting "Fatal: ... no such file or directory").
    for (const p of snapshot.paths ?? []) {
      if (!isAllowedProjectPath(p)) {
        throw HttpError.badRequest(t('backups.error.restorePathOutsideRoots', { path: p }));
      }
    }
    // Restic snapshots store absolute paths; `--target /` puts them back.
    await deps.resticRunner.restore(['restore', snapshot.id, '--target', '/']);
    return '/';
  }

  if (!deps.dockerClient) {
    throw HttpError.internal(t('backups.error.restoreNeedsDocker'));
  }
  const inspected = await deps.dockerClient.inspect(cls.db.container);
  if (!inspected.running) {
    throw HttpError.badRequest(
      t('backups.error.restoreContainerNotRunning', { container: cls.db.container }),
    );
  }
  const svc: ComposeService = {
    image: inspected.image || cls.db.type,
    environment: inspected.env,
  };
  let plan;
  try {
    plan = buildDbRestorePlan(cls.db, svc);
  } catch (err) {
    /* c8 ignore next 3 -- buildDbRestorePlan only throws UnsupportedRestoreError today */
    if (!(err instanceof UnsupportedRestoreError)) {
      throw err;
    }
    throw HttpError.badRequest(
      t('backups.error.restoreUnsupportedEngine', { type: err.engine }),
    );
  }
  await performDbRestore(snapshot.id, cls.artifactPath, plan, {
    restic: deps.resticRunner,
    docker: deps.dockerClient,
    log: (line) => logger.info({ projectId: String(project._id) }, line),
  });
  return cls.db.container;
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
