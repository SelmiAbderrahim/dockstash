import { describe, expect, it } from 'vitest';
import { ALLOWED_PATH_ROOT, isAllowedProjectPath } from './paths.js';

describe('isAllowedProjectPath', () => {
  it('rejects non-string input', () => {
    expect(isAllowedProjectPath(42)).toBe(false);
    expect(isAllowedProjectPath(undefined)).toBe(false);
    expect(isAllowedProjectPath(null)).toBe(false);
    expect(isAllowedProjectPath({})).toBe(false);
  });

  it('rejects empty and whitespace-only strings', () => {
    expect(isAllowedProjectPath('')).toBe(false);
    expect(isAllowedProjectPath('   ')).toBe(false);
  });

  it('rejects NUL bytes', () => {
    expect(isAllowedProjectPath('/var/www/app\0.evil')).toBe(false);
  });

  it('rejects traversal segments', () => {
    expect(isAllowedProjectPath('/var/www/../etc')).toBe(false);
    expect(isAllowedProjectPath('/var/www/app/..')).toBe(false);
  });

  it('rejects relative paths', () => {
    expect(isAllowedProjectPath('var/www/app')).toBe(false);
  });

  it('rejects paths outside /var/www', () => {
    expect(isAllowedProjectPath('/etc/passwd')).toBe(false);
    expect(isAllowedProjectPath('/var/log/app')).toBe(false);
  });

  it('rejects the allowed root itself and an empty tail', () => {
    expect(isAllowedProjectPath('/var/www/')).toBe(false);
    expect(isAllowedProjectPath('/var/www')).toBe(false);
  });

  it('accepts valid project paths under the allowlist', () => {
    expect(isAllowedProjectPath('/var/www/app')).toBe(true);
    expect(isAllowedProjectPath('/var/www/app/data')).toBe(true);
    expect(ALLOWED_PATH_ROOT).toBe('/var/www/');
  });
});
