// Collects a discovery snapshot (the agent host's /var/www folders + running
// Docker containers) so the server can browse this host's projects. Ships RAW
// container summaries; the server groups them (reusing groupByComposeProject).
import path from 'node:path';
import { readdir, access } from 'node:fs/promises';
import { ALLOWED_PATH_ROOT, isAllowedProjectPath } from './paths.js';
import type { DockerClient, DockerContainerSummary } from './docker-client.js';

/** Compose filenames, in the precedence order Docker Compose resolves them. */
export const COMPOSE_FILENAMES = [
  'docker-compose.yml',
  'docker-compose.yaml',
  'compose.yml',
  'compose.yaml',
] as const;

// Bound the snapshot so a pathological host can't bloat the heartbeat body.
const MAX_FOLDERS = 200;
const MAX_CONTAINERS = 500;

export interface AgentDiscoveredFolder {
  name: string;
  path: string;
  hasCompose: boolean;
  composeFile: string | null;
}

export interface AgentDiscoverySnapshot {
  folders: AgentDiscoveredFolder[];
  containers: DockerContainerSummary[];
  dockerAvailable: boolean;
}

export interface FolderEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isSymbolicLink: boolean;
}

export type FolderReader = (root: string) => Promise<FolderEntry[]>;
export type ComposeProbe = (dirPath: string) => Promise<string | null>;

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

export interface CollectDiscoveryDeps {
  folderReader?: FolderReader;
  composeProbe?: ComposeProbe;
  dockerClient: Pick<DockerClient, 'listContainers'>;
}

async function collectFolders(
  folderReader: FolderReader,
  composeProbe: ComposeProbe,
): Promise<AgentDiscoveredFolder[]> {
  let entries: FolderEntry[];
  try {
    entries = await folderReader(ALLOWED_PATH_ROOT);
  } catch {
    // /var/www may be absent or unreadable — an empty list is a valid snapshot.
    return [];
  }
  const folders: AgentDiscoveredFolder[] = [];
  for (const entry of entries) {
    if (folders.length >= MAX_FOLDERS) break;
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

/**
 * Build a discovery snapshot for this host. Never throws: a Docker failure
 * degrades to `dockerAvailable: false` with an empty container list so a
 * heartbeat is never blocked by discovery.
 */
export async function collectDiscovery(
  deps: CollectDiscoveryDeps,
): Promise<AgentDiscoverySnapshot> {
  const folderReader = deps.folderReader ?? defaultFolderReader;
  const composeProbe = deps.composeProbe ?? defaultComposeProbe;

  const folders = await collectFolders(folderReader, composeProbe);

  let containers: DockerContainerSummary[] = [];
  let dockerAvailable = true;
  try {
    containers = (await deps.dockerClient.listContainers()).slice(0, MAX_CONTAINERS);
  } catch {
    dockerAvailable = false;
  }

  return { folders, containers, dockerAvailable };
}
