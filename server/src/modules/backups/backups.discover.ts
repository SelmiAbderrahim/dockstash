import path from 'node:path';
import { readdir, access } from 'node:fs/promises';
import { HttpError } from '../../shared/utils/http-error.js';
import { env } from '../../config/env.js';
import { isAllowedProjectPath, ALLOWED_PATH_ROOT } from './backups.paths.js';
import { COMPOSE_FILENAMES } from './backups.scan.js';
import { HttpDockerClient } from './backups.docker-client.js';
import type { DockerClient, DockerContainerSummary } from './backups.boundaries.js';
import type { Translator } from './backups.service.js';

const identityT: Translator = (key) => key;

// ---------------------------------------------------------------------------
// Folder discovery — enumerate immediate subdirectories of /var/www.
// ---------------------------------------------------------------------------

/** A single filesystem entry, reduced to the flags folder discovery needs. */
export interface FolderEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isSymbolicLink: boolean;
}

/** Lists the immediate children of a directory. Injected in tests. */
export type FolderReader = (root: string) => Promise<FolderEntry[]>;

/** Resolves the first present compose filename in a directory, or null. */
export type ComposeProbe = (dirPath: string) => Promise<string | null>;

export interface DiscoveredFolder {
  name: string;
  path: string;
  hasCompose: boolean;
  composeFile: string | null;
}

export const defaultFolderReader: FolderReader = async (root) => {
  const entries = await readdir(root, { withFileTypes: true });
  return entries.map((e) => ({
    name: e.name,
    path: path.posix.join(root, e.name),
    isDirectory: e.isDirectory(),
    isSymbolicLink: e.isSymbolicLink(),
  }));
};

export const defaultComposeProbe: ComposeProbe = async (dirPath) => {
  for (const filename of COMPOSE_FILENAMES) {
    try {
      await access(path.posix.join(dirPath, filename));
      return filename;
    } catch {
      // try the next candidate
    }
  }
  return null;
};

export interface DiscoverFoldersDeps {
  folderReader?: FolderReader;
  composeProbe?: ComposeProbe;
  t?: Translator;
}

/**
 * List the immediate subdirectories of `/var/www` as candidate projects. Files
 * and symlinks are skipped (no follow-out), every emitted path is re-validated
 * through the allowlist, and each folder is flagged for a compose file so the
 * UI can distinguish a Compose project from a plain files-only folder.
 */
export async function discoverFolders(
  deps: DiscoverFoldersDeps = {},
): Promise<DiscoveredFolder[]> {
  const t = deps.t ?? identityT;
  const folderReader = deps.folderReader ?? defaultFolderReader;
  const composeProbe = deps.composeProbe ?? defaultComposeProbe;

  let entries: FolderEntry[];
  try {
    entries = await folderReader(ALLOWED_PATH_ROOT);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw HttpError.badRequest(t('backups.error.discoverFailed', { message }));
  }

  const folders: DiscoveredFolder[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory || entry.isSymbolicLink) continue;
    if (!isAllowedProjectPath(entry.path)) continue;
    const composeFile = await composeProbe(entry.path);
    folders.push({
      name: entry.name,
      path: entry.path,
      hasCompose: composeFile !== null,
      composeFile,
    });
  }
  folders.sort((a, b) => a.name.localeCompare(b.name));
  return folders;
}

// ---------------------------------------------------------------------------
// Container discovery — group running containers into Compose projects.
// ---------------------------------------------------------------------------

const LABEL_PROJECT = 'com.docker.compose.project';
const LABEL_WORKDIR = 'com.docker.compose.project.working_dir';
const LABEL_CONFIG = 'com.docker.compose.config_files';
const LABEL_SERVICE = 'com.docker.compose.service';

export interface DiscoveredContainerGroup {
  /** Compose project name, or the container name for a standalone container. */
  project: string;
  /** The Compose working directory (candidate project path), null if unknown. */
  workingDir: string | null;
  configFiles: string[];
  services: string[];
  containerNames: string[];
  /** True only when workingDir is a valid /var/www project path. */
  addable: boolean;
  /** True when the container is not part of a Compose project. */
  standalone: boolean;
}

export interface DiscoverContainersResult {
  containers: DiscoveredContainerGroup[];
  dockerAvailable: boolean;
}

interface GroupAccumulator {
  project: string;
  workingDir: string | null;
  configs: Set<string>;
  services: Set<string>;
  names: Set<string>;
  addable: boolean;
}

function containerName(c: DockerContainerSummary): string {
  return (c.names[0] ?? c.id).replace(/^\//, '');
}

/**
 * Reconstruct Compose project groupings from the `com.docker.compose.*` labels
 * on a set of running containers. Containers with no project label are surfaced
 * individually as non-addable standalone entries. Never throws on a single odd
 * container — missing labels degrade to empty sets.
 */
export function groupByComposeProject(
  containers: DockerContainerSummary[],
): DiscoveredContainerGroup[] {
  const groups = new Map<string, GroupAccumulator>();
  const standalone: DiscoveredContainerGroup[] = [];

  for (const c of containers) {
    const name = containerName(c);
    const project = c.labels[LABEL_PROJECT];
    if (!project) {
      standalone.push({
        project: name,
        workingDir: null,
        configFiles: [],
        services: [],
        containerNames: [name],
        addable: false,
        standalone: true,
      });
      continue;
    }

    let g = groups.get(project);
    if (!g) {
      const workingDir = c.labels[LABEL_WORKDIR] ?? null;
      g = {
        project,
        workingDir,
        configs: new Set<string>(),
        services: new Set<string>(),
        names: new Set<string>(),
        addable: workingDir !== null && isAllowedProjectPath(workingDir),
      };
      groups.set(project, g);
    }

    const service = c.labels[LABEL_SERVICE];
    if (service) g.services.add(service);
    const configFiles = c.labels[LABEL_CONFIG];
    if (configFiles) {
      for (const f of configFiles.split(',')) {
        const trimmed = f.trim();
        if (trimmed) g.configs.add(trimmed);
      }
    }
    g.names.add(name);
  }

  const grouped: DiscoveredContainerGroup[] = Array.from(groups.values()).map((g) => ({
    project: g.project,
    workingDir: g.workingDir,
    configFiles: Array.from(g.configs),
    services: Array.from(g.services).sort(),
    containerNames: Array.from(g.names).sort(),
    addable: g.addable,
    standalone: false,
  }));

  return [...grouped, ...standalone].sort((a, b) => a.project.localeCompare(b.project));
}

/**
 * Build a read-only Docker client for discovery from `env.DOCKER_HOST`, or null
 * when Docker is not configured (self-host / OSS boot without a socket proxy).
 */
export function makeDiscoveryDockerClient(): DockerClient | null {
  return env.DOCKER_HOST ? new HttpDockerClient({ dockerHost: env.DOCKER_HOST }) : null;
}

export interface DiscoverContainersDeps {
  dockerClient: DockerClient | null;
  t?: Translator;
}

/**
 * List running Compose projects on the local host. Returns `dockerAvailable:
 * false` (empty list) when no Docker client is configured rather than erroring,
 * so the UI can render a helpful state instead of a failure.
 */
export async function discoverContainers(
  deps: DiscoverContainersDeps,
): Promise<DiscoverContainersResult> {
  const t = deps.t ?? identityT;
  if (!deps.dockerClient) {
    return { containers: [], dockerAvailable: false };
  }
  let list: DockerContainerSummary[];
  try {
    list = await deps.dockerClient.listContainers();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw HttpError.badRequest(t('backups.error.discoverFailed', { message }));
  }
  return { containers: groupByComposeProject(list), dockerAvailable: true };
}
