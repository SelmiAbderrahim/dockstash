import path from 'node:path';
import { readFile } from 'node:fs/promises';
// js-yaml 5 is named-exports only — the v4 default export is gone.
import { load as loadYaml } from 'js-yaml';
import {
  matchAdapter,
  type ComposeService,
} from './backups.adapters.js';
import type { DatabaseType } from './backups.model.js';

export interface DatabasePlan {
  service: string;
  type: DatabaseType;
  container: string;
  enabled: boolean;
}

export interface BackupPlan {
  paths: string[];
  databases: DatabasePlan[];
  configs: string[];
}

interface ComposeFile {
  services?: Record<string, ComposeService>;
}

/**
 * File reader boundary — injected in tests so fixtures drive scanProject.
 */
export type FileReader = (absolutePath: string) => Promise<string>;

const defaultReader: FileReader = async (absolutePath) => readFile(absolutePath, 'utf8');

/**
 * Compose filenames Docker Compose itself resolves, in precedence order. The
 * scanner and the folder-discovery probe both walk this list so a project using
 * any common variant (not just `docker-compose.yml`) is detected.
 */
export const COMPOSE_FILENAMES = [
  'docker-compose.yml',
  'docker-compose.yaml',
  'compose.yml',
  'compose.yaml',
] as const;

/**
 * Read the first present compose file under `projectPath`. Returns its raw text
 * and the resolved filename; throws when none of the candidates exist.
 */
export async function readComposeFile(
  projectPath: string,
  read: FileReader,
): Promise<{ raw: string; filename: string }> {
  for (const filename of COMPOSE_FILENAMES) {
    try {
      const raw = await read(path.posix.join(projectPath, filename));
      return { raw, filename };
    } catch {
      // try the next candidate
    }
  }
  throw new Error('scanProject: docker-compose.yml not found');
}

export function resolveContainerName(projectPath: string, service: string): string {
  const projectSlug = path.posix.basename(projectPath).toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${projectSlug || 'project'}_${service}_1`;
}

export function detectProxyConfigs(compose: ComposeFile): string[] {
  const configs = new Set<string>();
  const services = compose.services ?? {};
  for (const svc of Object.values(services)) {
    const image = svc.image ?? '';
    if (/traefik/i.test(image)) configs.add('/etc/traefik');
    if (/nginx/i.test(image)) configs.add('/etc/nginx');
  }
  return Array.from(configs);
}

export interface ScanOptions {
  readFile?: FileReader;
}

export async function scanProject(
  projectPath: string,
  options: ScanOptions = {},
): Promise<BackupPlan> {
  const read = options.readFile ?? defaultReader;
  const { raw } = await readComposeFile(projectPath, read);
  const parsed = loadYaml(raw);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('scanProject: docker-compose.yml is not a valid mapping');
  }
  const compose = parsed as ComposeFile;
  const services = compose.services ?? {};

  const plan: BackupPlan = {
    paths: [projectPath],
    databases: [],
    configs: detectProxyConfigs(compose),
  };

  for (const [name, svc] of Object.entries(services)) {
    if (!svc || typeof svc !== 'object') continue;
    const adapter = matchAdapter(svc.image);
    if (!adapter) continue;
    plan.databases.push({
      service: name,
      type: adapter.type,
      container: svc.container_name ?? resolveContainerName(projectPath, name),
      enabled: true,
    });
  }

  return plan;
}
