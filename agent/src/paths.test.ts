import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROJECT_ROOT,
  isAllowedProjectPath,
  normalizeProjectRoot,
  parseProjectRoots,
} from './paths.js';

const ROOTS = ['/var/www', '/srv/apps'];

describe('isAllowedProjectPath', () => {
  it('rejects non-string input', () => {
    expect(isAllowedProjectPath(42, ROOTS)).toBe(false);
    expect(isAllowedProjectPath(undefined, ROOTS)).toBe(false);
    expect(isAllowedProjectPath(null, ROOTS)).toBe(false);
    expect(isAllowedProjectPath({}, ROOTS)).toBe(false);
  });

  it('rejects empty and whitespace-only strings', () => {
    expect(isAllowedProjectPath('', ROOTS)).toBe(false);
    expect(isAllowedProjectPath('   ', ROOTS)).toBe(false);
  });

  it('rejects NUL bytes', () => {
    expect(isAllowedProjectPath('/var/www/app\0.evil', ROOTS)).toBe(false);
  });

  it('rejects traversal segments', () => {
    expect(isAllowedProjectPath('/var/www/../etc', ROOTS)).toBe(false);
    expect(isAllowedProjectPath('/var/www/app/..', ROOTS)).toBe(false);
  });

  it('rejects relative paths', () => {
    expect(isAllowedProjectPath('var/www/app', ROOTS)).toBe(false);
  });

  it('rejects paths outside every configured root', () => {
    expect(isAllowedProjectPath('/etc/passwd', ROOTS)).toBe(false);
    expect(isAllowedProjectPath('/var/log/app', ROOTS)).toBe(false);
    expect(isAllowedProjectPath('/home/user/app', ROOTS)).toBe(false);
  });

  it('rejects sibling paths that share a root prefix without a boundary', () => {
    expect(isAllowedProjectPath('/var/wwwx/app', ROOTS)).toBe(false);
    expect(isAllowedProjectPath('/srv/appsx', ROOTS)).toBe(false);
  });

  it('rejects the filesystem root', () => {
    expect(isAllowedProjectPath('/', ROOTS)).toBe(false);
    expect(isAllowedProjectPath('//', ROOTS)).toBe(false);
  });

  it('accepts a path equal to a configured root (mount-exactly-one-project)', () => {
    expect(isAllowedProjectPath('/var/www', ROOTS)).toBe(true);
    expect(isAllowedProjectPath('/srv/apps/', ROOTS)).toBe(true);
  });

  it('accepts valid project paths under any configured root', () => {
    expect(isAllowedProjectPath('/var/www/app', ROOTS)).toBe(true);
    expect(isAllowedProjectPath('/var/www/app/data', ROOTS)).toBe(true);
    expect(isAllowedProjectPath('/srv/apps/shop', ROOTS)).toBe(true);
  });

  it('rejects everything when the roots list is empty', () => {
    expect(isAllowedProjectPath('/var/www/app', [])).toBe(false);
  });
});

describe('normalizeProjectRoot', () => {
  it('normalizes and strips trailing slashes', () => {
    expect(normalizeProjectRoot('/var/www/')).toBe('/var/www');
    expect(normalizeProjectRoot('  /srv/apps  ')).toBe('/srv/apps');
    expect(normalizeProjectRoot('/var//www')).toBe('/var/www');
  });

  it('rejects non-strings, empties, NUL, traversal and relative paths', () => {
    expect(normalizeProjectRoot(7)).toBeNull();
    expect(normalizeProjectRoot('')).toBeNull();
    expect(normalizeProjectRoot('   ')).toBeNull();
    expect(normalizeProjectRoot('/var/www\0')).toBeNull();
    expect(normalizeProjectRoot('/var/../etc')).toBeNull();
    expect(normalizeProjectRoot('var/www')).toBeNull();
  });

  it('rejects the filesystem root', () => {
    expect(normalizeProjectRoot('/')).toBeNull();
    expect(normalizeProjectRoot('///')).toBeNull();
  });

  it('rejects denied system prefixes, exact and nested', () => {
    for (const denied of ['/proc', '/sys', '/dev', '/etc', '/boot', '/run']) {
      expect(normalizeProjectRoot(denied)).toBeNull();
      expect(normalizeProjectRoot(`${denied}/sub`)).toBeNull();
    }
  });

  it('allows lookalike prefixes that only share characters with a denied one', () => {
    expect(normalizeProjectRoot('/etcetera')).toBe('/etcetera');
    expect(normalizeProjectRoot('/devops')).toBe('/devops');
  });
});

describe('parseProjectRoots', () => {
  it('parses a comma-separated list, deduping and preserving order', () => {
    expect(parseProjectRoots('/var/www, /srv/apps ,/var/www/')).toEqual({
      roots: ['/var/www', '/srv/apps'],
      invalid: [],
    });
  });

  it('skips empty segments', () => {
    expect(parseProjectRoots(',/var/www,,')).toEqual({
      roots: ['/var/www'],
      invalid: [],
    });
  });

  it('collects invalid entries instead of silently dropping them', () => {
    expect(parseProjectRoots('/var/www,/etc/nginx,relative')).toEqual({
      roots: ['/var/www'],
      invalid: ['/etc/nginx', 'relative'],
    });
  });

  it('exposes the documented default root', () => {
    expect(DEFAULT_PROJECT_ROOT).toBe('/var/www');
  });
});
