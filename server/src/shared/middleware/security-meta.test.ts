import { readFileSync } from 'node:fs';
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
  it('the Polar webhook raw-body route is declared BEFORE express.json() in app.ts', () => {
    const webhookIdx = APP_SRC.indexOf("'/api/billing/webhook'");
    const jsonIdx = APP_SRC.indexOf('express.json(');
    expect(webhookIdx).toBeGreaterThan(-1);
    expect(jsonIdx).toBeGreaterThan(-1);
    // Verify-before-parse: the handler must be attached to the app before the
    // global JSON parser consumes the buffer. See docs/security-model.en.md.
    expect(webhookIdx).toBeLessThan(jsonIdx);
  });

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
