import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * STEP 5 preventive guards for threat surface #1 (auth/session/rate-limit).
 * These are static checks over `server/src/app.ts` — if a future edit
 * regresses the mount order they fail loudly before the test suite ever
 * exercises the runtime. Cross-referenced from
 * `prompts/dockstash-security/01-auth-session-passport-jwt-opus-4.7.md` and
 * `docs/security-model.en.md`.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_TS = path.resolve(HERE, '../../app.ts');
const APP_SRC = readFileSync(APP_TS, 'utf8');
const PASSPORT_STRATEGIES_TS = path.resolve(HERE, '../../modules/auth/passport.strategies.ts');
const PASSPORT_STRATEGIES_SRC = readFileSync(PASSPORT_STRATEGIES_TS, 'utf8');

describe('security-meta: mount-order invariants for surface #1', () => {
  it('every authenticated /api/auth mutating route sits behind createAuthRateLimiter', () => {
    // The single `app.use('/api/auth', createAuthRateLimiter(), authRouter)`
    // mount governs all authenticated /api/auth routes. The public capability
    // probe `/api/auth` → `oauthPublicRouter` is mounted BEFORE and is
    // intentionally exempt (see the block comment above the mount).
    const rateLimitedMount =
      /app\.use\(\s*'\/api\/auth'\s*,\s*createAuthRateLimiter\(\)\s*,\s*authRouter\s*\)/;
    expect(rateLimitedMount.test(APP_SRC)).toBe(true);
    // And the public probe stays a read-only GET router — no mutating routes.
    // (Enforced by app.ts referencing oauthPublicRouter with no limiter.)
    expect(APP_SRC.includes("app.use('/api/auth', oauthPublicRouter);")).toBe(true);
  });

  it('every authenticated /api/health sub-router sits behind [requireAuth, requireVerified]', () => {
    // projectHealthRouter and backupHealthRouter must both be mounted via the
    // shared `verified` array — the same gate the rest of the product uses.
    // See S1-01 in prompts/dockstash-security/findings.md.
    expect(
      /app\.use\(\s*'\/api\/health\/projects'\s*,\s*verified\s*,\s*projectHealthRouter\s*\)/.test(
        APP_SRC,
      ),
    ).toBe(true);
    expect(
      /app\.use\(\s*'\/api\/health'\s*,\s*verified\s*,\s*backupHealthRouter\s*\)/.test(APP_SRC),
    ).toBe(true);
    // And the unauthenticated liveness router is mounted separately without
    // the `verified` array — public probe survives.
    expect(/app\.use\('\/api'\s*,\s*healthRouter\)/.test(APP_SRC)).toBe(true);
  });

  it('the JWT passport strategy pins algorithms: ["HS256"] — no alg-confusion escape hatch', () => {
    // Fail loudly if a future edit relaxes the algorithm pin (e.g. adds RS256
    // or removes the array). alg:none / alg-confusion bypass rides in on the
    // absence of this pin.
    expect(/algorithms:\s*\[\s*'HS256'\s*\]/.test(PASSPORT_STRATEGIES_SRC)).toBe(true);
    expect(/algorithms:\s*\[\s*'none'\s*\]/.test(PASSPORT_STRATEGIES_SRC)).toBe(false);
    // Only ONE jwt.verify path — the passport strategy. A hand-parsed second
    // verify would be a whole new surface. (Passport itself calls jwt.verify
    // under the hood — it's imported via passport-jwt, not directly here.)
    expect(/jsonwebtoken/.test(PASSPORT_STRATEGIES_SRC)).toBe(false);
    expect(/jwt\.verify\(/.test(PASSPORT_STRATEGIES_SRC)).toBe(false);
  });

  it('the CSRF cookie is `secure` in production (NODE_ENV === "production" gate)', () => {
    const csrfPath = path.resolve(HERE, './csrf.ts');
    const csrfSrc = readFileSync(csrfPath, 'utf8');
    expect(/secure:\s*env\.NODE_ENV\s*===\s*'production'/.test(csrfSrc)).toBe(true);
    // And the exemption is bearer-only — never extended to cookie-only.
    expect(/req\.headers\.authorization/.test(csrfSrc)).toBe(true);
  });
});

/**
 * Whole-tree guard for `passport-jwt-algorithms-pin.md`. The per-file check
 * above only reads `passport.strategies.ts`; a second, hand-rolled `jwt.verify`
 * elsewhere (e.g. the Socket.IO log-stream, an OAuth-state helper) is exactly
 * the "second verify path" the rule forbids. This scans EVERY non-test source
 * file under `server/src` and fails if any `jwt.verify(` call is not pinned to
 * `algorithms: ['HS256']`. This is the guard that should have caught F1.
 */
const SERVER_SRC = path.resolve(HERE, '../..');

function collectTsSources(root: string): string[] {
  return (readdirSync(root, { recursive: true, encoding: 'utf8' }) as string[])
    .filter(
      (rel) =>
        rel.endsWith('.ts') && !rel.endsWith('.d.ts') && !/\.test\.ts$/.test(rel),
    )
    .map((rel) => path.join(root, rel));
}

describe('security-meta: no unpinned jwt.verify anywhere in server/src (surface #1)', () => {
  it('every jwt.verify() call pins algorithms: ["HS256"]', () => {
    const HS256_PIN = /algorithms:\s*\[\s*'HS256'\s*\]/;
    const offenders: string[] = [];
    for (const file of collectTsSources(SERVER_SRC)) {
      const src = readFileSync(file, 'utf8');
      for (let idx = src.indexOf('jwt.verify('); idx !== -1; idx = src.indexOf('jwt.verify(', idx + 1)) {
        // A pinned call fits comfortably in the following window; an unpinned
        // one does not carry the HS256 array at all.
        if (!HS256_PIN.test(src.slice(idx, idx + 240))) {
          offenders.push(path.relative(SERVER_SRC, file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
