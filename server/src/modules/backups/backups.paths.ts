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
