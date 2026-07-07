import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * STEP 5 preventive guards for threat surface #4 (webhook & payment integrity).
 * These are static scans over the on-disk source — if a future edit regresses
 * verify-before-parse, drops the constant-time compare, or reorders the mount
 * so the raw-body handler sits behind the global JSON parser, these tests
 * fail loudly BEFORE the runtime suite is ever exercised.
 *
 * Cross-referenced from
 * `prompts/dockstash-security/04-webhook-payment-integrity-polar-opus-4.7.md`,
 * `.claude/rules/webhook-verify-before-parse.md`, and
 * `docs/polar-billing-and-webhooks.en.md`.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_TS = path.resolve(HERE, '../../../app.ts');
const APP_SRC = readFileSync(APP_TS, 'utf8');
const INGEST_TS = path.resolve(HERE, './ingest.ts');
const INGEST_SRC = readFileSync(INGEST_TS, 'utf8');
const POLAR_TS = path.resolve(HERE, '../providers/polar.ts');
const POLAR_SRC = readFileSync(POLAR_TS, 'utf8');
const MODEL_TS = path.resolve(HERE, '../webhook-event.model.ts');
const MODEL_SRC = readFileSync(MODEL_TS, 'utf8');

describe('surface #4 — webhook verify-before-parse invariants', () => {
  it('ingest.ts calls verifyWebhook BEFORE any provider.parseEvent', () => {
    const verifyIdx = INGEST_SRC.indexOf('provider.verifyWebhook(');
    const parseIdx = INGEST_SRC.indexOf('provider.parseEvent(');
    expect(verifyIdx).toBeGreaterThan(-1);
    expect(parseIdx).toBeGreaterThan(-1);
    // verify MUST execute before parse — a regression that parses first is a
    // Critical finding (unsigned JSON reaches the handler).
    expect(verifyIdx).toBeLessThan(parseIdx);
    // And ingest must not JSON.parse the buffer itself outside the provider.
    expect(/JSON\.parse\s*\(/.test(INGEST_SRC)).toBe(false);
  });

  it('ingest.ts routes duplicate deliveries through the (provider, eventId) unique guard', () => {
    // The INSERT-first idempotency contract: on a duplicate-key error the
    // handler acks 200 without re-dispatching a processed event. This is the
    // only place `isDuplicateKeyError` is expected to appear.
    expect(/isDuplicateKeyError\s*\(/.test(INGEST_SRC)).toBe(true);
    expect(/WebhookEvent\.create\s*\(/.test(INGEST_SRC)).toBe(true);
  });

  it('webhook-event.model.ts declares the unique (provider, eventId) index', () => {
    // The DB-level guard that closes the replay window at write time.
    expect(
      /webhookEventSchema\.index\(\s*\{\s*provider:\s*1\s*,\s*eventId:\s*1\s*\}\s*,\s*\{\s*unique:\s*true\s*\}\s*\)/.test(
        MODEL_SRC,
      ),
    ).toBe(true);
  });

  it('providers/polar.ts uses crypto.timingSafeEqual for signature comparison', () => {
    // Constant-time compare closes the timing side-channel on the signature.
    expect(/timingSafeEqual\s*\(/.test(POLAR_SRC)).toBe(true);
    // And it must be imported from node:crypto (not a naive local wrapper).
    expect(/from ['"]node:crypto['"]/.test(POLAR_SRC)).toBe(true);
    // The exact call is on the length-guarded candidate buffer; a regression to
    // `===`/`==` on a signature buffer is a Critical finding.
    expect(
      /if\s*\(\s*timingSafeEqual\s*\(\s*candidate\s*,\s*expected\s*\)\s*\)/.test(POLAR_SRC),
    ).toBe(true);
  });

  it('providers/polar.ts fails closed when POLAR_WEBHOOK_SECRET is unset', () => {
    // The verify entrypoint MUST throw when the configured secret is empty —
    // never no-op the check, never return 200 silently. This is the
    // fail-closed guarantee.
    expect(
      /if\s*\(\s*!secret\s*\)\s*\{[\s\S]*?throw new WebhookVerifyError\(/.test(POLAR_SRC),
    ).toBe(true);
    // The default factory reads env.POLAR_WEBHOOK_SECRET (not a hardcoded
    // fallback that would defeat the guarantee).
    expect(/env\.POLAR_WEBHOOK_SECRET/.test(POLAR_SRC)).toBe(true);
  });

  it('providers/polar.ts enforces a replay-window tolerance on webhook-timestamp', () => {
    // A stolen delivery replayed hours later must be rejected.
    expect(/REPLAY_TOLERANCE_SECONDS/.test(POLAR_SRC)).toBe(true);
    expect(
      /Math\.abs\(now - tsSeconds\)\s*>\s*REPLAY_TOLERANCE_SECONDS/.test(POLAR_SRC),
    ).toBe(true);
  });

  it('providers/polar.ts never compares signatures with === / == / != on a signature-shaped identifier', () => {
    // Best-effort static scan: no `sig* === …` / `signature* == …` — the
    // timingSafeEqual test above is the strong guarantee; this catches
    // ad-hoc helper regressions in the same module.
    const banned = /\b(sig|signature|hmac|digest|expected|candidate)\w*\s*(===|==|!=|!==)/i;
    // Filter to source lines only (drop the module doc-comment noise).
    for (const line of POLAR_SRC.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
      expect(banned.test(line), `naive compare in polar.ts: ${line}`).toBe(false);
    }
  });
});

describe('surface #4 — mount-order invariants in app.ts', () => {
  it('the rate limiter runs BEFORE express.raw() on the webhook route', () => {
    // A flood of forged signatures must hit the limiter before it can burn
    // signature math OR consume the request bytes needed for HMAC.
    const mount = APP_SRC.match(
      /app\.post\(\s*'\/api\/billing\/webhook'\s*,\s*createWebhookRateLimiter\(\)\s*,\s*express\.raw\(/,
    );
    expect(mount, 'webhook route mount order regression').not.toBeNull();
  });

  it('the raw-body webhook route is declared BEFORE express.json()', () => {
    // Redundant with security-meta.test.ts but colocated with the rest of
    // the surface-#4 guards so a webhook-only refactor lands here first.
    const webhookIdx = APP_SRC.indexOf("'/api/billing/webhook'");
    const jsonIdx = APP_SRC.indexOf('express.json(');
    expect(webhookIdx).toBeGreaterThan(-1);
    expect(jsonIdx).toBeGreaterThan(-1);
    expect(webhookIdx).toBeLessThan(jsonIdx);
  });
});
