/**
 * Build the one-paste install command shown after agent registration. The
 * daemon must reach the API host, so we derive the server URL from
 * `VITE_API_BASE_URL` (stripping any `/api` suffix) and fall back to the
 * current page origin — never a hardcoded URL.
 */

const TOKEN_PLACEHOLDER = '<AGENT_TOKEN>';

/** Root every agent falls back to when no project directories are entered. */
export const DEFAULT_PROJECT_ROOT = '/var/www';

// Mirrors the agent-side denylist (agent/src/paths.ts): kernel/runtime
// pseudo-filesystems and host config may never be project roots.
const DENIED_ROOT_PREFIXES = ['/proc', '/sys', '/dev', '/etc', '/boot', '/run'];

function isUnder(candidate: string, prefix: string): boolean {
  return candidate === prefix || candidate.startsWith(`${prefix}/`);
}

/**
 * Client-side mirror of the agent's root validation so a typo fails in the
 * dialog, not as a silent crash-loop on the VPS. Returns the normalized root
 * (no trailing slash) or `null` when unusable.
 */
export function normalizeProjectRoot(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.includes('\0')) return null;
  if (trimmed.includes('..')) return null;
  if (!trimmed.startsWith('/')) return null;
  const normalized = trimmed.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  if (normalized.length === 0 || normalized === '/') return null;
  if (DENIED_ROOT_PREFIXES.some((p) => isUnder(normalized, p))) return null;
  return normalized;
}

export interface ParsedProjectRoots {
  roots: string[];
  /** Raw entries that failed validation — surfaced inline in the dialog. */
  invalid: string[];
}

/** Parse a comma- or newline-separated roots input. Dedups, keeps order. */
export function parseProjectRootsInput(raw: string): ParsedProjectRoots {
  const roots: string[] = [];
  const invalid: string[] = [];
  for (const part of raw.split(/[\n,]/)) {
    const entry = part.trim();
    if (entry.length === 0) continue;
    const normalized = normalizeProjectRoot(entry);
    if (normalized === null) {
      invalid.push(entry);
    } else if (!roots.includes(normalized)) {
      roots.push(normalized);
    }
  }
  return { roots, invalid };
}

export function resolveAgentServerUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (typeof base === 'string' && /^https?:\/\//i.test(base)) {
    try {
      return new URL(base).origin;
    } catch {
      // malformed absolute URL — fall through to the page origin
    }
  }
  return window.location.origin;
}

export interface InstallCommandOptions {
  token?: string;
  serverUrl: string;
  /** Project directories the agent may discover/back up. Default: /var/www. */
  roots?: string[];
}

/**
 * A single copy-paste that writes the compose file and brings the agent up.
 * When `token` is absent (recovery / setup view) a literal placeholder is
 * emitted for the user to replace. Every root is bind-mounted rw (restores
 * write files back) and listed in DOCKSTASH_PROJECT_ROOTS.
 */
export function buildAgentInstallCommand({
  token,
  serverUrl,
  roots,
}: InstallCommandOptions): string {
  const value = token ?? TOKEN_PLACEHOLDER;
  const mounts = roots && roots.length > 0 ? roots : [DEFAULT_PROJECT_ROOT];
  return [
    "cat > docker-compose.agent.yml <<'EOF'",
    'services:',
    '  docker-socket-proxy:',
    '    image: tecnativa/docker-socket-proxy:0.3.0',
    '    restart: unless-stopped',
    '    environment:',
    '      CONTAINERS: 1',
    '      EXEC: 1',
    '      POST: 1',
    '      INFO: 1',
    // DB restores bounce the target container after placing the artifact.
    '      ALLOW_RESTARTS: 1',
    '    volumes:',
    '      - /var/run/docker.sock:/var/run/docker.sock:ro',
    '    security_opt: [no-new-privileges:true]',
    '    cap_drop: [ALL]',
    '  agent:',
    '    image: selmiabderrahim/agent:latest',
    '    restart: unless-stopped',
    '    depends_on: [docker-socket-proxy]',
    '    environment:',
    `      DOCKSTASH_URL: ${serverUrl}`,
    `      DOCKSTASH_AGENT_TOKEN: ${value}`,
    '      DOCKER_HOST: tcp://docker-socket-proxy:2375',
    `      DOCKSTASH_PROJECT_ROOTS: ${mounts.join(',')}`,
    '    volumes:',
    ...mounts.map((root) => `      - ${root}:${root}:rw`),
    '    tmpfs: [/tmp]',
    '    security_opt: [no-new-privileges:true]',
    '    cap_drop: [ALL]',
    'EOF',
    'docker compose -f docker-compose.agent.yml pull',
    'docker compose -f docker-compose.agent.yml up -d --force-recreate',
  ].join('\n');
}

/**
 * The two-command update sequence for an already-installed agent — pull the
 * latest image and recreate the container. No token/roots needed; the existing
 * `docker-compose.agent.yml` on the host already holds them.
 */
export function buildAgentUpdateCommand(): string {
  return [
    'docker compose -f docker-compose.agent.yml pull',
    'docker compose -f docker-compose.agent.yml up -d --force-recreate',
  ].join('\n');
}

export { TOKEN_PLACEHOLDER };
