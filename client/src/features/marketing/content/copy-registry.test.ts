import { describe, it, expect, beforeEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isGuidePath,
  hasGuideCopy,
  getGuideCopy,
  loadGuideCopy,
  __resetGuideCopyForTests,
} from './copy-registry';
import { GUIDE_COPY as EN_COPY } from './locale/guides.en';

beforeEach(() => {
  __resetGuideCopyForTests();
});

describe('isGuidePath', () => {
  it('matches the hub and article paths only', () => {
    expect(isGuidePath('/guides')).toBe(true);
    expect(isGuidePath('/guides/backup-postgres-docker')).toBe(true);
    expect(isGuidePath('/guides/connect-fleet-agent')).toBe(true);
    expect(isGuidePath('/')).toBe(false);
    expect(isGuidePath('/pricing')).toBe(false);
    expect(isGuidePath('/guidesfoo')).toBe(false);
  });
});

describe('copy registry', () => {
  it('starts empty and loads a locale bundle', async () => {
    expect(hasGuideCopy('en')).toBe(false);
    expect(getGuideCopy('en')).toBeUndefined();

    await loadGuideCopy('en');

    expect(hasGuideCopy('en')).toBe(true);
    expect(getGuideCopy('en')).toBe(EN_COPY);
  });

  it('falls back to the English bundle for a not-yet-loaded locale', async () => {
    await loadGuideCopy('en');
    expect(hasGuideCopy('fr')).toBe(false);
    expect(getGuideCopy('fr')).toBe(EN_COPY);
  });

  it('serves the locale bundle (not the fallback) once loaded', async () => {
    await loadGuideCopy('en');
    await loadGuideCopy('fr');
    expect(hasGuideCopy('fr')).toBe(true);
    expect(getGuideCopy('fr')).not.toBe(EN_COPY);
  });

  it('loads every supported locale through its dynamic-import loader', async () => {
    const locales = ['en', 'ar', 'fr', 'de', 'es', 'ru', 'zh'] as const;
    for (const locale of locales) {
      await loadGuideCopy(locale);
      expect(hasGuideCopy(locale)).toBe(true);
      expect(getGuideCopy(locale)?.services.postgres).toBeDefined();
    }
  });

  it('dedupes concurrent loads and resolves instantly when cached', async () => {
    const first = loadGuideCopy('en');
    const second = loadGuideCopy('en');
    // In-flight dedupe: both callers share the same promise.
    expect(second).toBe(first);
    await first;
    // Cached early-return arm.
    await expect(loadGuideCopy('en')).resolves.toBeUndefined();
    expect(getGuideCopy('en')).toBe(EN_COPY);
  });
});

describe('locale bundle isolation (chunking guard)', () => {
  it('no app module statically imports a locale copy bundle', () => {
    // A static import of content/locale/guides.<locale> from app code would
    // silently inline that locale's prose into the main chunk. Only the
    // registry's dynamic imports (and tests) may reference those modules.
    const root = join(__dirname, '..', '..', '..');
    const offenders: string[] = [];
    const files = readdirSync(root, { recursive: true }) as string[];
    for (const relative of files) {
      if (!/\.(ts|tsx)$/.test(relative)) continue;
      if (/\.test\.(ts|tsx)$/.test(relative)) continue;
      if (relative.includes('node_modules')) continue;
      const normalized = relative.split('\\').join('/');
      if (normalized.includes('content/locale/')) continue;
      if (normalized.endsWith('content/copy-registry.ts')) continue;
      const source = readFileSync(join(root, relative), 'utf-8');
      if (/^import[^;]*['"][^'"]*locale\/guides\./m.test(source)) {
        offenders.push(normalized);
      }
    }
    expect(offenders).toEqual([]);
  });
});
