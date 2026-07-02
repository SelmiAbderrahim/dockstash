// Parity guard between the app-shell route tree and server.js's APP_PREFIXES
// (app-paths.mjs). Any top-level app route segment missing from APP_PREFIXES
// would be SSR'd by the web server and land on the marketing 404 catch-all.
import { describe, expect, it } from 'vitest';
// app-paths.mjs lives outside src/ so the no-build web server (server.js)
// can import it directly.
import { APP_PREFIXES } from '../../app-paths.mjs';
import { appShellRoutes } from './routes';
import { marketingRoutes } from '@features/marketing';

function firstSegments(routes: { path?: string }[]): string[] {
  return routes
    .filter((route) => typeof route.path === 'string')
    .map((route) => `/${(route.path as string).split('/')[0]}`);
}

describe('APP_PREFIXES parity', () => {
  const appSegments = firstSegments(
    appShellRoutes.flatMap((route) => route.children ?? []),
  );

  it('extracts at least one app route segment', () => {
    expect(appSegments.length).toBeGreaterThan(0);
  });

  it('covers every top-level app-shell route', () => {
    for (const segment of appSegments) {
      expect(APP_PREFIXES, `app route ${segment} missing from app-paths.mjs`).toContain(
        segment,
      );
    }
  });

  it('never collides with a static marketing route', () => {
    const marketingSegments = new Set(
      firstSegments(marketingRoutes.flatMap((route) => route.children ?? [])).filter(
        (segment) => !segment.includes(':') && !segment.includes('*'),
      ),
    );
    for (const prefix of APP_PREFIXES) {
      expect(marketingSegments.has(prefix), `${prefix} is also a marketing route`).toBe(
        false,
      );
    }
  });
});
