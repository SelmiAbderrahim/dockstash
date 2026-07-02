import { env } from '../../config/env.js';
import { decryptSecret } from '../../shared/crypto/index.js';
import { loadTransportForUser } from '../settings/settings.service.js';
import type { ResticRunnerExt } from '../scheduler/scheduler.boundaries.js';
import type { DispatchDeps } from '../scheduler/scheduler.dispatcher.js';
import { Project } from './backups.model.js';
import {
  ProcessResticRunner,
  type ProcessResticRunnerOptions,
} from './backups.restic-runner.js';
import { HttpDockerClient } from './backups.docker-client.js';
import {
  makeArtifactDbDiff,
  makeHashFileDiff,
  makeStatfsDiskProbe,
  makeTmpScratch,
} from './backups.diff.js';

/** Placeholder runner: every method fails loudly. The default until
 * `RESTIC_RUNNER=process` — a job that fires without the real runner goes
 * through the retry+alert path instead of silently succeeding. */
export function placeholderResticRunner(): ResticRunnerExt {
  const notWired = async (): Promise<never> => {
    throw new Error('restic runner not wired');
  };
  return {
    init: notWired,
    backup: notWired,
    snapshots: notWired,
    check: notWired,
    restore: notWired,
    unlock: notWired,
    forget: notWired,
  };
}

export type RunnerBuilder = (opts: ProcessResticRunnerOptions) => ResticRunnerExt;

const defaultBuilder: RunnerBuilder = (opts) => new ProcessResticRunner(opts);

/**
 * Resolve the concrete runner for a project: the owner's pinned SFTP transport
 * gives the repo URL + SSH material; the project row gives the repo password.
 */
export async function resolveProjectRunner(
  projectId: string,
  owner: string,
  build: RunnerBuilder = defaultBuilder,
): Promise<ResticRunnerExt> {
  const project = await Project.findById(projectId);
  if (!project || project.owner.toString() !== owner) {
    throw new Error(`resolveProjectRunner: project ${projectId} not found for owner`);
  }
  const { transport, settings } = await loadTransportForUser(owner);
  /* c8 ignore next 3 -- unreachable: loadTransportForUser only returns configured settings, which implies sshKeyEnc */
  if (!settings.sshKeyEnc) {
    throw new Error('resolveProjectRunner: storage SSH key missing');
  }
  return build({
    repoUrl: transport.repoUrl({ id: String(project._id), owner }),
    password: decryptSecret(project.repoPasswordEnc),
    ssh: {
      privateKey: decryptSecret(settings.sshKeyEnc),
      hostKeyLine: settings.hostKeyLine,
    },
  });
}

/**
 * Sync factory shape required by `StartSchedulerOptions.resticRunnerFor`.
 * Resolution (project row, transport, decryption) is lazy — it happens on the
 * first method call and is memoized for the job's lifetime.
 */
export function makeResticRunnerFor(
  projectId: string,
  owner: string,
  build: RunnerBuilder = defaultBuilder,
): ResticRunnerExt {
  let resolved: Promise<ResticRunnerExt> | null = null;
  const get = (): Promise<ResticRunnerExt> => {
    resolved ??= resolveProjectRunner(projectId, owner, build);
    return resolved;
  };
  return {
    init: async () => (await get()).init(),
    backup: async (args, opts) => (await get()).backup(args, opts),
    snapshots: async () => (await get()).snapshots(),
    check: async (args) => (await get()).check(args),
    restore: async (args) => (await get()).restore(args),
    unlock: async () => (await get()).unlock(),
    forget: async (args) => (await get()).forget(args),
  };
}

export interface DispatchDepsOverrides {
  dockerHost?: string;
  scratchBase?: string;
}

/**
 * Production DispatchDeps (everything but the runner): docker client over the
 * socket proxy, statfs disk probe, tmpfs scratch, hash/artifact diffs.
 */
export function makeDispatchDepsFor(
  overrides: DispatchDepsOverrides = {},
): Omit<DispatchDeps, 'resticRunner'> {
  const dockerHost = overrides.dockerHost ?? env.DOCKER_HOST;
  return {
    ...(dockerHost
      ? { dockerClient: new HttpDockerClient({ dockerHost }) }
      : {}),
    diskProbe: makeStatfsDiskProbe(overrides.scratchBase),
    scratch: makeTmpScratch(overrides.scratchBase),
    fileDiff: makeHashFileDiff(),
    dbDiff: makeArtifactDbDiff(),
  };
}
