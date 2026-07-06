import { HttpError } from '../../shared/utils/http-error.js';
import { DEFAULT_LOCALE, translate } from '../../shared/i18n/index.js';
import type { TranslationVars } from '../../shared/i18n/index.js';
import { sendFailureAlert } from '../alerting/index.js';
import { allowedRootsForProject, loadOwnedProject } from './backups.service.js';
import { isAllowedProjectPath, isPathUnderRoots } from './backups.paths.js';

export type Translator = (key: string, vars?: TranslationVars) => string;
const identityT: Translator = (key, vars) => translate(DEFAULT_LOCALE, key, vars);

/**
 * Minimal restic surface the mirror needs — a structural subset of
 * `ResticRunner` so this service stays decoupled from runner growth.
 */
export interface MirrorRunner {
  backup(args: string[]): Promise<void>;
  restore(args: string[]): Promise<void>;
}

export interface RunMirrorDeps {
  t?: Translator;
  resticRunner: MirrorRunner;
}

export interface RunMirrorResult {
  ok: boolean;
  detail: string;
}

/** Snapshot tag that isolates mirror snapshots from the backup train. */
export const MIRROR_TAG = 'mirror';

/**
 * One-way mirror (Business): back the source directory up into the project
 * repo under the `mirror` tag, then restore the latest mirror snapshot onto
 * the target directory. Both paths must live inside the project-root
 * allowlist — the same guard the restore path enforces. Restic recreates the
 * full source path under `--target`, giving a consistent point-in-time copy
 * rather than a live rsync (deletes propagate on the next cycle because each
 * mirror snapshot is complete).
 */
export async function runMirror(
  projectId: string,
  userId: string,
  deps: RunMirrorDeps,
): Promise<RunMirrorResult> {
  const t = deps.t ?? identityT;
  const project = await loadOwnedProject(projectId, userId, { t });
  const cfg = project.mirror;
  if (!cfg?.enabled || !cfg.sourcePath || !cfg.targetPath) {
    throw HttpError.badRequest(t('backups.error.mirrorNotConfigured'));
  }
  const roots = await allowedRootsForProject(project, userId, { t });
  for (const p of [cfg.sourcePath, cfg.targetPath]) {
    const allowed = roots ? isPathUnderRoots(p, roots) : isAllowedProjectPath(p);
    if (!allowed) {
      throw HttpError.badRequest(t('backups.error.pathNotAllowed', { path: p }));
    }
  }
  try {
    await deps.resticRunner.backup(['backup', cfg.sourcePath, '--tag', MIRROR_TAG]);
    await deps.resticRunner.restore([
      'restore',
      'latest',
      '--tag',
      MIRROR_TAG,
      '--target',
      cfg.targetPath,
    ]);
    return { ok: true, detail: t('backups.success.mirrorComplete') };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sendFailureAlert({
      projectId: String(project._id),
      kind: 'mirror',
      error: message,
    });
    throw HttpError.internal(t('backups.error.mirrorFailed', { message }));
  }
}
