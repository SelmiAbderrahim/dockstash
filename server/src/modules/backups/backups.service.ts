import { HttpError } from '../../shared/utils/http-error.js';
import { logger } from '../../config/logger.js';
import { encryptSecret, decryptSecret } from '../../shared/crypto/index.js';
import type { TranslationVars } from '../../shared/i18n/index.js';
import { assertProjectCap } from '../billing/entitlements.service.js';
import { sendFailureAlert } from '../alerting/index.js';
// Cycle-safe: agents.service imports backups.model, never this file.
import { loadOwnedAgent } from '../agents/agents.service.js';
import {
  Project,
  type ProjectHydrated,
  type BackupStatus,
} from './backups.model.js';
import { isAllowedProjectPath } from './backups.paths.js';
import { scanProject, type BackupPlan } from './backups.scan.js';
import type {
  DockerClient,
  ResticRunner,
  DiskSpaceProbe,
} from './backups.boundaries.js';
import { MIN_FREE_BYTES_DEFAULT } from './backups.boundaries.js';
import { matchAdapter, type ComposeService } from './backups.adapters.js';
import type { CreateProjectInput } from './backups.schema.js';

export type Translator = (key: string, vars?: TranslationVars) => string;

/**
 * The translator boundary — controllers pass `req.t`. If a caller (background
 * job) has no request context we fall through to a passthrough that returns the
 * key so alerting still sees a stable identifier.
 */
const identityT: Translator = (key) => key;

function assertAllowedPath(input: string, t: Translator): void {
  if (!isAllowedProjectPath(input)) {
    throw HttpError.badRequest(t('backups.error.pathNotAllowed', { path: input }));
  }
}

export interface CreateProjectDeps {
  t?: Translator;
}

export async function createProject(
  userId: string,
  input: CreateProjectInput,
  deps: CreateProjectDeps = {},
): Promise<ProjectHydrated> {
  const t = deps.t ?? identityT;
  assertAllowedPath(input.path, t);
  for (const p of input.plan?.paths ?? []) assertAllowedPath(p, t);
  for (const c of input.plan?.configs ?? []) assertAllowedPath(c, t);
  // A create-time agent assignment must own the agent (mirrors updateProjectAgent).
  if (input.agentId) await loadOwnedAgent(input.agentId, userId, deps);
  const repoPasswordEnc = encryptSecret(input.repoPassword);
  const plan = input.plan ?? { paths: [input.path], databases: [], configs: [] };
  const project = await Project.create({
    owner: userId,
    name: input.name,
    path: input.path,
    plan,
    repoPasswordEnc,
    lastStatus: 'idle',
    ...(input.agentId ? { agent: input.agentId } : {}),
  });
  return project;
}

export interface LoadOwnedProjectDeps {
  t?: Translator;
}

export async function loadOwnedProject(
  projectId: string,
  userId: string,
  deps: LoadOwnedProjectDeps = {},
): Promise<ProjectHydrated> {
  const t = deps.t ?? identityT;
  const project = await Project.findById(projectId);
  if (!project) throw HttpError.notFound(t('backups.error.projectNotFound'));
  if (project.owner.toString() !== userId) {
    throw HttpError.forbidden(t('backups.error.notOwner'));
  }
  return project;
}

export async function listProjectsForUser(userId: string): Promise<ProjectHydrated[]> {
  return Project.find({ owner: userId }).sort({ createdAt: -1 });
}

export interface UpdatePlanDeps {
  t?: Translator;
}

export async function updateProjectPlan(
  projectId: string,
  userId: string,
  plan: BackupPlan,
  deps: UpdatePlanDeps = {},
): Promise<ProjectHydrated> {
  const t = deps.t ?? identityT;
  const project = await loadOwnedProject(projectId, userId, deps);
  for (const p of plan.paths) assertAllowedPath(p, t);
  for (const c of plan.configs) assertAllowedPath(c, t);
  project.plan = {
    paths: plan.paths,
    databases: plan.databases.map((d) => ({
      service: d.service,
      type: d.type,
      container: d.container,
      enabled: d.enabled,
    })),
    configs: plan.configs,
  } as ProjectHydrated['plan'];
  await project.save();
  return project;
}

/**
 * Assign the project to a fleet agent (or back to local with null). Ownership
 * of BOTH the project and the agent is enforced; the scheduler's agent-aware
 * queue reads `project.agent` at enqueue time.
 */
export async function updateProjectAgent(
  projectId: string,
  userId: string,
  agentId: string | null,
  deps: UpdatePlanDeps = {},
): Promise<ProjectHydrated> {
  const project = await loadOwnedProject(projectId, userId, deps);
  if (agentId !== null) {
    await loadOwnedAgent(agentId, userId, deps);
  }
  project.agent = (agentId as unknown) as ProjectHydrated['agent'];
  await project.save();
  return project;
}

export interface ScanServiceDeps {
  t?: Translator;
  scanner?: typeof scanProject;
}

export async function scanProjectPath(
  projectPath: string,
  deps: ScanServiceDeps = {},
): Promise<BackupPlan> {
  const t = deps.t ?? identityT;
  assertAllowedPath(projectPath, t);
  const scanner = deps.scanner ?? scanProject;
  try {
    return await scanner(projectPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw HttpError.badRequest(t('backups.error.scanFailed', { message }));
  }
}

/**
 * Compose services are only carried forward for their env — the adapter uses
 * them to build the dump argv. The service always trusts the plan for the
 * `container` identifier so we never re-derive it at run time.
 */
export interface RunBackupDeps {
  t?: Translator;
  resticRunner: ResticRunner;
  dockerClient: DockerClient;
  diskProbe?: DiskSpaceProbe;
  minFreeBytes?: number;
  composeServices?: Record<string, ComposeService>;
}

export interface RunBackupResult {
  status: BackupStatus;
  layers: Array<{ kind: 'database' | 'paths'; label: string; ok: boolean; error?: string }>;
}

export async function runBackup(
  projectId: string,
  userId: string,
  deps: RunBackupDeps,
): Promise<RunBackupResult> {
  const t = deps.t ?? identityT;
  const project = await loadOwnedProject(projectId, userId, { t });
  if (project.paused) {
    throw HttpError.forbidden(t('billing.entitlements.projectPaused'), {
      reason: 'projectPaused',
    });
  }
  await assertProjectCap(userId, {
    t,
    countActiveProjects: async () =>
      Project.countDocuments({ owner: userId, paused: { $ne: true } }),
  });
  assertAllowedPath(project.path, t);
  for (const p of project.plan.paths) assertAllowedPath(p, t);
  // `configs` share the restic argv with `paths`; re-assert the allowlist here
  // so a plan persisted through any path (recovery import, legacy row) cannot
  // smuggle an out-of-tree file into the backup.
  for (const c of project.plan.configs) assertAllowedPath(c, t);

  if (deps.diskProbe) {
    const minFree = deps.minFreeBytes ?? MIN_FREE_BYTES_DEFAULT;
    const free = await deps.diskProbe.freeBytes();
    if (free < minFree) {
      const detail = t('backups.error.noSpace', { free });
      await markStatus(project, 'failed', detail);
      try {
        await sendFailureAlert({
          projectId: String(project._id),
          kind: 'backup',
          error: detail,
        });
      } catch (alertErr) {
        logger.error({ err: alertErr }, 'backup failure alert emit failed');
      }
      throw HttpError.internal(detail);
    }
  }

  // Decrypt only in-process. Never log; never return.
  decryptSecret(project.repoPasswordEnc);

  await markStatus(project, 'running', '');

  const layers: RunBackupResult['layers'] = [];
  const composeServices = deps.composeServices ?? {};

  try {
    for (const db of project.plan.databases) {
      if (!db.enabled) continue;
      const svc = composeServices[db.service] ?? { image: db.type };
      const adapter = matchAdapter(svc.image ?? db.type);
      if (!adapter) {
        throw new Error(`no adapter matched service ${db.service}`);
      }
      const argv = adapter.dumpCmd(svc);
      assertArgvSafe(argv);
      let stream;
      try {
        stream = await deps.dockerClient.exec(db.container, argv);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`dump failed for ${db.service}: ${message}`);
      }
      try {
        if (adapter.mode === 'file') {
          // File-artifact engines (RDB, snapshot-API, mirror/export tools):
          // the dump produces an artifact inside the container. Wait for the
          // command to finish (drain its output), then restic-back-up the path.
          // `mode: 'file'` narrows the adapter union so dumpArtifactPath exists.
          await drainStream(stream);
          await deps.resticRunner.backup(['backup', adapter.dumpArtifactPath(svc)]);
        } else {
          // stdin engines stream their dump straight into restic (no disk hop).
          await deps.resticRunner.backup(
            ['backup', '--stdin', '--stdin-filename', `${db.service}.dump`],
            { stdin: stream },
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`restic dump failed: ${message}`);
      }
      layers.push({ kind: 'database', label: db.service, ok: true });
    }

    const pathArgs = [...project.plan.paths, ...project.plan.configs];
    if (pathArgs.length > 0) {
      try {
        await deps.resticRunner.backup(['backup', ...pathArgs]);
        layers.push({ kind: 'paths', label: 'files', ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`restic paths failed: ${message}`);
      }
    }

    await markStatus(project, 'success', '');
    return { status: 'success', layers };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    layers.push({ kind: 'database', label: 'run', ok: false, error: message });
    await markStatus(project, 'failed', message);
    try {
      await sendFailureAlert({
        projectId: String(project._id),
        kind: 'backup',
        error: message,
      });
    } catch (alertErr) {
      logger.error({ err: alertErr }, 'backup failure alert emit failed');
    }
    throw HttpError.internal(t('backups.error.backupFailed', { message }));
  }
}

async function markStatus(
  project: ProjectHydrated,
  status: BackupStatus,
  error: string,
): Promise<void> {
  project.lastStatus = status;
  project.lastError = error;
  const now = new Date();
  project.lastRunAt = now;
  if (status === 'success') {
    project.lastSuccessAt = now;
    project.lastHeartbeatAlertAt = null;
    // Each successful run adds a snapshot — feeds per-project metering.
    /* c8 ignore next -- schema defaults snapshotCount to 0 so the nullish fallback never fires */
    project.snapshotCount = (project.snapshotCount ?? 0) + 1;
  }
  await project.save();
}

/**
 * Consume a container-exec stream to completion. For file-artifact adapters we
 * don't pipe the output anywhere — we only need the dump command to finish
 * (and surface any error) before restic backs up the produced path.
 */
function drainStream(stream: NodeJS.ReadableStream): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    stream.on('error', reject);
    stream.on('end', resolve);
    stream.resume();
  });
}

/**
 * Defensive: assert every argv token is a plain string with no NUL bytes.
 * Adapter authors already return arrays, but this is a belt-and-braces guard
 * against a future adapter regression that would degrade to a shell-string.
 */
function assertArgvSafe(argv: unknown): asserts argv is string[] {
  if (!Array.isArray(argv)) {
    throw new Error('assertArgvSafe: argv must be an array');
  }
  for (const tok of argv) {
    if (typeof tok !== 'string') {
      throw new Error('assertArgvSafe: argv token must be a string');
    }
    if (tok.includes('\0')) {
      throw new Error('assertArgvSafe: argv token contains NUL');
    }
  }
}
