// Guards the hand-maintained mirror between the client marketing content
// (client/src/features/marketing/content/*, routes.tsx, shared/seo/schema.ts)
// and this module's sitemap inventory (seo.data.ts). Reads the client sources
// as text — a cross-package import would break the server tsconfig rootDir.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COMPETITOR_SLUGS,
  CORE_PATHS,
  GUIDE_SLUGS,
  SEO_LASTMOD,
  USECASE_SLUGS,
} from './seo.data.js';

const CLIENT_ROOT = new URL('../../../../client/src/', import.meta.url);

function readClientFile(relative: string): string {
  return readFileSync(new URL(relative, CLIENT_ROOT), 'utf-8');
}

/** Extract `slug: '<value>'` entries; asserts the format still matches. */
function extractSlugs(relative: string): string[] {
  const source = readClientFile(relative);
  const slugs = [...source.matchAll(/^\s+slug: '([^']+)',$/gm)].map((m) => m[1] ?? '');
  expect(slugs.length, `no slugs extracted from ${relative}`).toBeGreaterThan(0);
  return slugs;
}

describe('client ↔ server SEO parity', () => {
  it('guide slugs match client content', () => {
    expect(new Set(extractSlugs('features/marketing/content/guides.ts'))).toEqual(
      new Set(GUIDE_SLUGS),
    );
  });

  it('use-case slugs match client content', () => {
    expect(new Set(extractSlugs('features/marketing/content/use-cases.ts'))).toEqual(
      new Set(USECASE_SLUGS),
    );
  });

  it('competitor slugs match client content', () => {
    expect(new Set(extractSlugs('features/marketing/content/competitors.ts'))).toEqual(
      new Set(COMPETITOR_SLUGS),
    );
  });

  it('SEO_LASTMOD matches the client SITE_LAST_UPDATED', () => {
    const source = readClientFile('shared/seo/schema.ts');
    const match = source.match(/^export const SITE_LAST_UPDATED = '([^']+)';$/m);
    expect(match, 'SITE_LAST_UPDATED not found in client schema.ts').not.toBeNull();
    expect(match?.[1]).toBe(SEO_LASTMOD);
  });

  it('every static marketing route is in the sitemap', () => {
    const source = readClientFile('features/marketing/routes.tsx');
    const paths = [...source.matchAll(/path: '([^']+)'/g)]
      .map((m) => m[1] ?? '')
      // Parameterized routes are covered by the slug sitemaps; a `*` splat
      // (not-found) must never be in the sitemap.
      .filter((p) => !p.includes(':') && !p.includes('*'));
    expect(paths.length, 'no static routes extracted from routes.tsx').toBeGreaterThan(0);
    for (const path of paths) {
      expect(CORE_PATHS, `route /${path} missing from CORE_PATHS`).toContain(`/${path}`);
    }
    expect(CORE_PATHS).toContain('/'); // the index route
  });
});
