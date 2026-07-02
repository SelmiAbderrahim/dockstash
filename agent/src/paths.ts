// Vendored from server/src/modules/backups/backups.paths.ts — keep in sync manually.
import path from 'node:path';

const ALLOWED_ROOT = '/var/www/';

/**
 * Validate a filesystem path against the `/var/www/*` allowlist.
 * Rejects traversal segments (`..`), non-absolute paths, empty paths, and any
 * value that normalizes outside `/var/www`. Re-run agent-side so a tampered
 * job payload can never point restic outside the allowlist.
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
