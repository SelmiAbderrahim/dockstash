import { HttpError } from '../../shared/utils/http-error.js';
import { logger } from '../../config/logger.js';
import { DEFAULT_LOCALE, translate } from '../../shared/i18n/index.js';
import { sendFailureAlert } from '../alerting/index.js';
import {
  Project,
  type ProjectHydrated,
  type VerifyStatus,
} from './backups.model.js';
import type {
  ResticRunner,
  ScratchWorkspace,
  FileDiffer,
  DbDiffer,
} from './backups.boundaries.js';
import { loadOwnedProject, type Translator } from './backups.service.js';

/**
 * Fallback translator: when a background job has no request, still render the
 * localized default-locale string (with vars interpolated) so persisted detail
 * fields are human-readable, not raw keys.
 */
const identityT: Translator = (key, vars) => translate(DEFAULT_LOCALE, key, vars);

export interface RunCheckDeps {
  t?: Translator;
  resticRunner: ResticRunner;
  readDataSubset?: number;
}

export interface RunCheckResult {
  status: VerifyStatus;
  detail: string;
}

export async function runResticCheck(
  projectId: string,
  userId: string,
  deps: RunCheckDeps,
): Promise<RunCheckResult> {
  const t = deps.t ?? identityT;
  const project = await loadOwnedProject(projectId, userId, { t });
  const args = ['check'];
  if (typeof deps.readDataSubset === 'number') {
    args.push('--read-data-subset', `${deps.readDataSubset}%`);
  }
  try {
    await deps.resticRunner.check(args);
    const detail = t('backups.check.pass');
    await stampCheck(project, 'pass', detail);
    return { status: 'pass', detail };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const detail = t('backups.check.fail', { message });
    await stampCheck(project, 'fail', detail);
    return { status: 'fail', detail };
  }
}

export interface RunDrillDeps {
  t?: Translator;
  resticRunner: ResticRunner;
  scratch: ScratchWorkspace;
  fileDiff: FileDiffer;
  dbDiff: DbDiffer;
}

export interface RunDrillResult {
  status: VerifyStatus;
  detail: string;
  mismatches: number;
}

export async function runRestoreDrill(
  projectId: string,
  userId: string,
  deps: RunDrillDeps,
): Promise<RunDrillResult> {
  const t = deps.t ?? identityT;
  const project = await loadOwnedProject(projectId, userId, { t });

  let snapshots: Array<{ id: string; time: string }>;
  try {
    snapshots = await deps.resticRunner.snapshots();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const detail = t('backups.drill.fail', { message });
    await stampDrill(project, 'fail', detail);
    return { status: 'fail', detail, mismatches: 0 };
  }

  if (snapshots.length === 0) {
    const detail = t('backups.drill.nothingToRestore');
    await stampDrill(project, 'fail', detail);
    return { status: 'fail', detail, mismatches: 0 };
  }

  let scratchPath: string | null = null;
  try {
    scratchPath = await deps.scratch.create();
    await deps.resticRunner.restore(['restore', 'latest', '--target', scratchPath]);

    let totalMismatches = 0;
    const details: string[] = [];

    for (const sourceRoot of [...project.plan.paths, ...project.plan.configs]) {
      const res = await deps.fileDiff.diff(sourceRoot, scratchPath);
      totalMismatches += res.mismatches;
      if (res.mismatches > 0) details.push(...res.details);
    }

    for (const db of project.plan.databases) {
      if (!db.enabled) continue;
      const restoredDumpPath = `${scratchPath}/${db.service}.dump`;
      const res = await deps.dbDiff.diff({
        container: db.container,
        service: db.service,
        restoredDumpPath,
      });
      totalMismatches += res.mismatches;
      if (res.mismatches > 0) details.push(...res.details);
    }

    if (totalMismatches === 0) {
      const detail = t('backups.drill.pass');
      await stampDrill(project, 'pass', detail);
      return { status: 'pass', detail, mismatches: 0 };
    }
    const detail = t('backups.drill.failMismatches', {
      count: totalMismatches,
      details: details.join('; '),
    });
    await stampDrill(project, 'fail', detail);
    return { status: 'fail', detail, mismatches: totalMismatches };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const detail = t('backups.drill.fail', { message });
    await stampDrill(project, 'fail', detail);
    return { status: 'fail', detail, mismatches: 0 };
    /* c8 ignore next -- the catch above handles every throw, so the finally's abrupt-completion path is unreachable */
  } finally {
    if (scratchPath) {
      try {
        await deps.scratch.remove(scratchPath);
      } catch (cleanupErr) {
        logger.warn(
          { err: cleanupErr, scratchPath },
          'backups.drill: scratch cleanup failed',
        );
      }
    }
  }
}

async function stampCheck(
  project: ProjectHydrated,
  status: VerifyStatus,
  detail: string,
): Promise<void> {
  project.lastCheckAt = new Date();
  project.lastCheckStatus = status;
  project.lastCheckDetail = detail;
  await project.save();
}

async function stampDrill(
  project: ProjectHydrated,
  status: VerifyStatus,
  detail: string,
): Promise<void> {
  project.lastDrillAt = new Date();
  project.lastDrillStatus = status;
  project.lastDrillDetail = detail;
  await project.save();
  if (status === 'fail') {
    try {
      await sendFailureAlert({
        projectId: String(project._id),
        kind: 'drill',
        error: detail,
      });
    } catch (err) {
      logger.error({ err, projectId: String(project._id) }, 'drill failure alert emit failed');
    }
  }
}

/**
 * Iterate projects and run `restic check` on each. A failing project MUST NOT
 * abort the loop — log and continue. Registered on a cron by prompt 05.
 */
export interface ScheduleRunDeps {
  resticRunnerFor(project: ProjectHydrated): ResticRunner;
  readDataSubset?: number;
}

export interface ScheduleResult {
  projectId: string;
  status: 'pass' | 'fail' | 'error';
  detail: string;
}

export async function runScheduledChecks(
  deps: ScheduleRunDeps,
): Promise<ScheduleResult[]> {
  const projects = await Project.find({});
  const results: ScheduleResult[] = [];
  for (const project of projects) {
    try {
      const res = await runResticCheck(project._id.toString(), project.owner.toString(), {
        resticRunner: deps.resticRunnerFor(project),
        readDataSubset: deps.readDataSubset,
      });
      results.push({
        projectId: project._id.toString(),
        status: res.status,
        detail: res.detail,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, projectId: project._id.toString() }, 'scheduled check failed');
      results.push({
        projectId: project._id.toString(),
        status: 'error',
        detail: message,
      });
    }
  }
  return results;
}

export interface ScheduleDrillDeps extends ScheduleRunDeps {
  scratchFor(project: ProjectHydrated): ScratchWorkspace;
  fileDiffFor(project: ProjectHydrated): FileDiffer;
  dbDiffFor(project: ProjectHydrated): DbDiffer;
}

export async function runScheduledDrills(
  deps: ScheduleDrillDeps,
): Promise<ScheduleResult[]> {
  const projects = await Project.find({});
  const results: ScheduleResult[] = [];
  for (const project of projects) {
    try {
      const res = await runRestoreDrill(
        project._id.toString(),
        project.owner.toString(),
        {
          resticRunner: deps.resticRunnerFor(project),
          scratch: deps.scratchFor(project),
          fileDiff: deps.fileDiffFor(project),
          dbDiff: deps.dbDiffFor(project),
        },
      );
      results.push({
        projectId: project._id.toString(),
        status: res.status,
        detail: res.detail,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, projectId: project._id.toString() }, 'scheduled drill failed');
      results.push({
        projectId: project._id.toString(),
        status: 'error',
        detail: message,
      });
    }
  }
  return results;
}

// Re-export HttpError so schedule callers can distinguish ownership errors.
export { HttpError };
