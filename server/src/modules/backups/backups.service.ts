import { HttpError } from '../../shared/utils/http-error.js';
import { logger } from '../../config/logger.js';
import { encryptSecret, decryptSecret } from '../../shared/crypto/index.js';
import type { TranslationVars } from '../../shared/i18n/index.js';
import { sendFailureAlert } from '../alerting/index.js';
// Cycle-safe: agents.service imports backups.model, never this file.
import { allowedRootsForAgent, loadOwnedAgent } from '../agents/agents.service.js';
import {
  Project,
  type ProjectHydrated,
  type BackupStatus,
} from './backups.model.js';
import { isAllowedProjectPath, isPathUnderRoots } from './backups.paths.js';
import { scanProject, type BackupPlan } from './backups.scan.js';
import type {
  DockerClient,
  DockerExecStream,
  ResticRunner,
  DiskSpaceProbe,
} from './backups.boundaries.js';
import { MIN_FREE_BYTES_DEFAULT } from './backups.boundaries.js';
import {
  matchAdapter,
  type ComposeService,
  type FileAdapter,
  type StdinAdapter,
} from './backups.adapters.js';
import { dbSnapshotTag } from './backups.restore-plan.js';
import type { CreateProjectInput } from './backups.schema.js';
import path from 'node:path';
import { isValidObjectId } from 'mongoose';

export type Translator = (key: string, vars?: TranslationVars) => string;

/**
 * The translator boundary — controllers pass `req.t`. If a caller (background
 * job) has no request context we fall through to a passthrough that returns the
 * key so alerting still sees a stable identifier.
 */
const identityT: Translator = (key) => key;

/**
 * restic `backup` exit code 3: the snapshot was created but some source files
 * could not be read (e.g. permission denied). Matches the error format the
 * restic-runner produces (`restic backup exit 3: <stderr>`). Kept in sync with
 * agent/src/backup.ts.
 */
export function isPartialReadFailure(message: string): boolean {
  return /^restic backup exit 3:/.test(message);
}

function assertAllowedPath(input: string, t: Translator, roots?: readonly string[]): void {
  // Local execution keeps the strict legacy /var/www allowlist; agent-assigned
  // projects validate against the roots THAT agent reported (see
  // allowedRootsForProject). Both re-run agent/local-side before restic.
  const allowed = roots ? isPathUnderRoots(input, roots) : isAllowedProjectPath(input);
  if (!allowed) {
    throw HttpError.badRequest(t('backups.error.pathNotAllowed', { path: input }));
  }
}

/**
 * Resolve the path allowlist for a project: the assigned agent's reported
 * roots, or `undefined` for local execution (strict /var/www). Exported for
 * the scheduler's restore-enqueue validation.
 */
export async function allowedRootsForProject(
  project: Pick<ProjectHydrated, 'agent'>,
  userId: string,
  deps: { t?: Translator } = {},
): Promise<string[] | undefined> {
  if (!project.agent) return undefined;
  const agent = await loadOwnedAgent(String(project.agent), userId, deps);
  return allowedRootsForAgent(agent);
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
  // A create-time agent assignment must own the agent (mirrors updateProjectAgent);
  // its reported roots become the allowlist for every path in the project.
  const agent = input.agentId ? await loadOwnedAgent(input.agentId, userId, deps) : null;
  const roots = agent ? allowedRootsForAgent(agent) : undefined;
  assertAllowedPath(input.path, t, roots);
  for (const p of input.plan?.paths ?? []) assertAllowedPath(p, t, roots);
  for (const c of input.plan?.configs ?? []) assertAllowedPath(c, t, roots);
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
  // Owner scope is applied AT QUERY TIME — a foreign-owner id and a genuinely
  // missing id are indistinguishable to the caller (both 404). This cloaks
  // resource existence: an attacker iterating ObjectIds cannot enumerate the
  // directory of every tenant's projects. See prompts/dockstash-security/
  // 02-cross-account-idor-isolation-opus-4.7.md (surface #2, S2-01).
  if (!isValidObjectId(projectId)) {
    throw HttpError.notFound(t('backups.error.projectNotFound'));
  }
  const project = await Project.findOne({ _id: projectId, owner: userId });
  if (!project) throw HttpError.notFound(t('backups.error.projectNotFound'));
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
  const roots = await allowedRootsForProject(project, userId, deps);
  for (const p of plan.paths) assertAllowedPath(p, t, roots);
  for (const c of plan.configs) assertAllowedPath(c, t, roots);
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

/** Set/clear the per-project outbound alert webhook ('' = cleared). */
export async function updateProjectAlerts(
  projectId: string,
  userId: string,
  webhookUrl: string,
  deps: UpdatePlanDeps = {},
): Promise<ProjectHydrated> {
  const project = await loadOwnedProject(projectId, userId, deps);
  project.alertWebhookUrl = webhookUrl;
  await project.save();
  return project;
}

/**
 * Update the one-way mirror config (Business). When enabling, both paths must
 * live inside the project-root allowlist — the same guard the mirror runner
 * re-checks at execution time (belt and braces, like restore).
 */
export async function updateProjectMirror(
  projectId: string,
  userId: string,
  input: { enabled: boolean; sourcePath: string; targetPath: string },
  deps: UpdatePlanDeps = {},
): Promise<ProjectHydrated> {
  const t = deps.t ?? identityT;
  const project = await loadOwnedProject(projectId, userId, deps);
  if (input.enabled) {
    const roots = await allowedRootsForProject(project, userId, deps);
    for (const p of [input.sourcePath, input.targetPath]) {
      const allowed = roots ? isPathUnderRoots(p, roots) : isAllowedProjectPath(p);
      if (!allowed) {
        throw HttpError.badRequest(t('backups.error.pathNotAllowed', { path: p }));
      }
    }
  }
  project.mirror = input as ProjectHydrated['mirror'];
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

export interface RunBackupDeps {
  t?: Translator;
  resticRunner: ResticRunner;
  dockerClient: DockerClient;
  diskProbe?: DiskSpaceProbe;
  minFreeBytes?: number;
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

  try {
    for (const db of project.plan.databases) {
      if (!db.enabled) continue;
      // Inspect the container for its real image/env/cmd — the credential
      // source the dump adapters need (POSTGRES_USER, MONGO creds, redis
      // requirepass). A stopped container can never dump, so fail fast with an
      // actionable hint. Mirrors the restore path's inspect step.
      const inspected = await deps.dockerClient.inspect(db.container);
      if (!inspected.running) {
        throw new Error(t('backups.error.containerNotRunning', { container: db.container }));
      }
      const svc: ComposeService = {
        image: inspected.image || db.type,
        environment: inspected.env,
        command: inspected.cmd,
      };
      const adapter = matchAdapter(svc.image);
      if (!adapter) {
        throw new Error(`no adapter matched service ${db.service}`);
      }
      if (adapter.mode === 'file') {
        await backupFileLayer(db, adapter, svc, deps, t);
      } else {
        await backupStdinLayer(db, adapter, svc, deps, t);
      }
      layers.push({ kind: 'database', label: db.service, ok: true });
    }

    let pathsWarning = '';
    const pathArgs = [...project.plan.paths, ...project.plan.configs];
    if (pathArgs.length > 0) {
      try {
        await deps.resticRunner.backup(['backup', ...pathArgs]);
        layers.push({ kind: 'paths', label: 'files', ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // restic exit 3 = snapshot WAS created but some source files were
        // unreadable. Warn and keep the (partial) snapshot instead of failing
        // the run — a hard fail here pressures operators into chmod'ing their
        // project trees, which is worse than a flagged partial backup. Kept in
        // sync with agent/src/backup.ts::isPartialReadFailure.
        if (isPartialReadFailure(message)) {
          pathsWarning = `warning: snapshot created but some files were unreadable: ${message}`;
          layers.push({ kind: 'paths', label: 'files', ok: true });
        } else {
          throw new Error(`restic paths failed: ${message}`);
        }
      }
    }

    await markStatus(project, 'success', pathsWarning);
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
 * A file-mode dump writes its artifact INSIDE the container; restic runs on the
 * host and cannot read it there. Build the command to stream the artifact back
 * out — `cat` for a single file, `tar` for a directory — plus the filename it
 * lands under in the restic snapshot. Kept in sync with agent/src/backup.ts.
 */
function artifactReadPlan(
  adapter: FileAdapter,
  svc: ComposeService,
  service: string,
): { readArgv: string[]; stdinFilename: string } {
  const artifactPath = adapter.dumpArtifactPath(svc);
  if (adapter.artifactType === 'directory') {
    return {
      readArgv: ['tar', '-cf', '-', '-C', artifactPath, '.'],
      stdinFilename: `${service}.tar`,
    };
  }
  return {
    readArgv: ['cat', artifactPath],
    stdinFilename: `${service}-${path.posix.basename(artifactPath)}`,
  };
}

/** A DB layer, narrowed to the fields the dump helpers read. */
interface DbLayer {
  service: string;
  container: string;
  type: string;
}

/**
 * Pipe a streaming exec's stdout into `restic backup --stdin`, then read the
 * dump's OWN exit code and stderr tail. restic will happily snapshot an empty
 * or truncated stdin and report success — the dump exit code is the only
 * signal that the source command actually produced a complete dump. Kept in
 * sync with agent/src/backup.ts.
 */
async function streamIntoRestic(
  es: DockerExecStream,
  resticArgs: string[],
  deps: RunBackupDeps,
): Promise<{ exitCode: number; stderrTail: string; resticErr?: string }> {
  let resticErr: string | undefined;
  try {
    await deps.resticRunner.backup(resticArgs, { stdin: es.stream });
  } catch (err) {
    resticErr = err instanceof Error ? err.message : String(err);
  }
  const { exitCode, stderrTail } = await es.exit();
  return { exitCode, stderrTail, resticErr };
}

/** One stdin-dump attempt: open the exec, stream it into restic, report the dump exit. */
async function runStdinDumpAttempt(
  db: DbLayer,
  adapter: StdinAdapter,
  argv: string[],
  env: string[] | undefined,
  deps: RunBackupDeps,
): Promise<{ exitCode: number; stderrTail: string; resticErr?: string }> {
  assertArgvSafe(argv);
  let es: DockerExecStream;
  try {
    es = await deps.dockerClient.execStream(db.container, argv, { env });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`dump failed for ${db.service}: ${message}`);
  }
  return streamIntoRestic(
    es,
    [
      'backup',
      '--stdin',
      '--stdin-filename',
      `${db.service}.dump`,
      '--tag',
      dbSnapshotTag(db.service, adapter.type),
    ],
    deps,
  );
}

/**
 * stdin-adapter layer. A clean dump (exit 0) that restic then fails on is a
 * real restic error (network/disk/lock). A non-zero dump exit is the dump's
 * own failure — surfaced with its stderr, or retried ONCE if the adapter
 * offers a fallback argv (mongodump dropping `--oplog` on standalone mongo).
 */
async function backupStdinLayer(
  db: DbLayer,
  adapter: StdinAdapter,
  svc: ComposeService,
  deps: RunBackupDeps,
  t: Translator,
): Promise<void> {
  const env = adapter.dumpEnv?.(svc);
  const first = await runStdinDumpAttempt(db, adapter, adapter.dumpCmd(svc), env, deps);
  if (first.exitCode === 0) {
    if (first.resticErr) throw new Error(`restic dump failed: ${first.resticErr}`);
    return;
  }
  const alt = adapter.fallbackDumpCmd?.(svc, first.stderrTail) ?? null;
  const attempt = alt ? await runStdinDumpAttempt(db, adapter, alt, env, deps) : first;
  if (alt && attempt.exitCode === 0) {
    if (attempt.resticErr) throw new Error(`restic dump failed: ${attempt.resticErr}`);
    return;
  }
  throw new Error(
    t('backups.error.dumpFailed', {
      service: db.service,
      message: `exit ${attempt.exitCode}: ${attempt.stderrTail || 'no stderr'}`,
    }),
  );
}

/**
 * file-adapter layer. The dump writes an artifact INSIDE the container; run it
 * to completion (execCollect gives the exit code + both channels), assert it
 * succeeded (and pass any adapter `verifyDump`, e.g. redis SAVE must reply OK —
 * redis-cli exits 0 even on NOAUTH), THEN stream the artifact out — checking
 * that read's exit too so a missing artifact is a clear error, not "no data".
 * Kept in sync with agent/src/backup.ts.
 */
async function backupFileLayer(
  db: DbLayer,
  adapter: FileAdapter,
  svc: ComposeService,
  deps: RunBackupDeps,
  t: Translator,
): Promise<void> {
  const argv = adapter.dumpCmd(svc);
  assertArgvSafe(argv);
  let res;
  try {
    res = await deps.dockerClient.execCollect(db.container, argv, adapter.dumpEnv?.(svc));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`dump failed for ${db.service}: ${message}`);
  }
  if (res.exitCode !== 0) {
    throw new Error(
      t('backups.error.dumpFailed', {
        service: db.service,
        message: `exit ${res.exitCode}: ${res.stderr.trim() || 'no stderr'}`,
      }),
    );
  }
  adapter.verifyDump?.(res);

  const { readArgv, stdinFilename } = artifactReadPlan(adapter, svc, db.service);
  assertArgvSafe(readArgv);
  let es: DockerExecStream;
  try {
    es = await deps.dockerClient.execStream(db.container, readArgv);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`artifact read failed for ${db.service}: ${message}`);
  }
  const { exitCode, stderrTail, resticErr } = await streamIntoRestic(
    es,
    [
      'backup',
      '--stdin',
      '--stdin-filename',
      stdinFilename,
      '--tag',
      dbSnapshotTag(db.service, adapter.type),
    ],
    deps,
  );
  if (exitCode !== 0) {
    throw new Error(
      `artifact read failed for ${db.service} (exit ${exitCode}): ${stderrTail || 'no stderr'}`,
    );
  }
  if (resticErr) throw new Error(`restic dump failed: ${resticErr}`);
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
