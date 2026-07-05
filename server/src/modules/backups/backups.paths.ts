import path from 'node:path';

const ALLOWED_ROOT = '/var/www/';

/**
 * Validate a filesystem path against the `/var/www/*` allowlist.
 * Rejects traversal segments (`..`), non-absolute paths, empty paths, and any
 * value that normalizes outside `/var/www`. Symlink resolution is the caller's
 * responsibility at invocation time; this check is a pre-flight guard so no
 * user-controlled string ever reaches restic / dockerode without normalization.
 */
export function isAllowedProjectPath(input: unknown): input is string {
  if (typeof input !== 'string') return false;
  const trimmed = input.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.includes('\0')) return false;
  if (trimmed.includes('..')) return false;
  if (!path.isAbsolute(trimmed)) return false;
  const normalized = path.posix.normalize(trimmed);
  if (!normalized.startsWith(ALLOWED_ROOT)) return false;
  const tail = normalized.slice(ALLOWED_ROOT.length);
  if (tail.length === 0) return false;
  return true;
}

export const ALLOWED_PATH_ROOT = ALLOWED_ROOT;

// ---------------------------------------------------------------------------
// Multi-root (fleet-agent) variants. An agent reports the project roots it was
// configured with (DOCKSTASH_PROJECT_ROOTS); paths for agent-assigned projects
// validate against THAT agent's roots instead of the static local allowlist.
// Vendored into agent/src/paths.ts — keep semantics in sync.
// ---------------------------------------------------------------------------

/** Fallback allowlist for agents that predate configurable roots. */
export const DEFAULT_AGENT_ROOTS: readonly string[] = ['/var/www'];

/**
 * Prefixes that may never be project roots, even when explicitly configured:
 * kernel/runtime pseudo-filesystems and host config. A root here would let a
 * (tampered) job payload read or — via restore — overwrite host state.
 */
const DENIED_ROOT_PREFIXES = ['/proc', '/sys', '/dev', '/etc', '/boot', '/run'];

function isUnder(candidate: string, prefix: string): boolean {
  return candidate === prefix || candidate.startsWith(`${prefix}/`);
}

/**
 * Validate + canonicalize ONE agent-reported project root. Returns the
 * normalized root (no trailing slash) or `null` when the value is unusable:
 * relative, traversal, NUL, `/` itself, or under a denied system prefix.
 */
export function normalizeProjectRoot(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.includes('\0')) return null;
  if (trimmed.includes('..')) return null;
  if (!path.isAbsolute(trimmed)) return null;
  const normalized = path.posix.normalize(trimmed).replace(/\/+$/, '');
  if (normalized.length === 0 || normalized === '/') return null;
  if (DENIED_ROOT_PREFIXES.some((p) => isUnder(normalized, p))) return null;
  return normalized;
}

/**
 * Structural safety only — absolute, no traversal/NUL, not `/`. Used by the
 * request schemas; WHICH roots a path must live under is enforced later in the
 * service layer, where the project's agent (and its roots) is known.
 */
export function isSafeAbsolutePath(input: unknown): input is string {
  if (typeof input !== 'string') return false;
  const trimmed = input.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.includes('\0')) return false;
  if (trimmed.includes('..')) return false;
  if (!path.isAbsolute(trimmed)) return false;
  const normalized = path.posix.normalize(trimmed).replace(/\/+$/, '');
  return normalized.length > 0 && normalized !== '/';
}

/**
 * Validate a path against a set of allowed roots. A path EQUAL to a root is
 * allowed — operators may mount exactly one project directory as a root.
 */
export function isPathUnderRoots(input: unknown, roots: readonly string[]): input is string {
  if (!isSafeAbsolutePath(input)) return false;
  const normalized = path.posix.normalize(input.trim()).replace(/\/+$/, '');
  return roots.some((root) => isUnder(normalized, root));
}
