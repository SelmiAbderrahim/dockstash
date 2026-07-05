// Vendored from server/src/modules/backups/backups.paths.ts — keep in sync manually.
import path from 'node:path';

/** Root every agent falls back to when DOCKSTASH_PROJECT_ROOTS is unset. */
export const DEFAULT_PROJECT_ROOT = '/var/www';

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
 * Validate + canonicalize ONE configured project root. Returns the normalized
 * root (no trailing slash) or `null` when the value is unusable: relative,
 * traversal, NUL, `/` itself, or under a denied system prefix.
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

export interface ParsedProjectRoots {
  roots: string[];
  /** Raw entries that failed validation — surfaced so a typo is never silent. */
  invalid: string[];
}

/** Parse the comma-separated DOCKSTASH_PROJECT_ROOTS value. Dedups, keeps order. */
export function parseProjectRoots(raw: string): ParsedProjectRoots {
  const roots: string[] = [];
  const invalid: string[] = [];
  for (const part of raw.split(',')) {
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

/**
 * Validate a filesystem path against the configured project-root allowlist.
 * Rejects traversal segments (`..`), non-absolute paths, empty paths, and any
 * value that normalizes outside every allowed root. A path EQUAL to a root is
 * allowed — operators may mount exactly one project directory as a root.
 * Re-run agent-side so a tampered job payload can never point restic outside
 * the allowlist the operator chose.
 */
export function isAllowedProjectPath(
  input: unknown,
  roots: readonly string[],
): input is string {
  if (typeof input !== 'string') return false;
  const trimmed = input.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.includes('\0')) return false;
  if (trimmed.includes('..')) return false;
  if (!path.isAbsolute(trimmed)) return false;
  const normalized = path.posix.normalize(trimmed).replace(/\/+$/, '');
  if (normalized.length === 0 || normalized === '/') return false;
  return roots.some((root) => isUnder(normalized, root));
}
