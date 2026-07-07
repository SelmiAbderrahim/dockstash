# Surface #4 — Webhook & Payment Integrity (Polar) — Build Prompt

> **Closes findings under threat surface #4 of `prompts/SECURITY.md`.** Owns
> Standard-Webhooks HMAC verification on the raw body BEFORE `JSON.parse`,
> `timingSafeEqual` for signatures, fail-closed when `POLAR_WEBHOOK_SECRET` is
> unset, idempotency against replayed events, and the rate-limiter-before-raw
> mount. This is one of the four highest-value Dockstash surfaces. Implements
> STEP 2 → STEP 3 → STEP 4 → STEP 5 for this surface only.

---

## Agent

`security-review-specialist` (primary). Coordinate with `backend-dev` for the
webhook ingest/handler plumbing and the idempotency record. Run `00-recon-
findings` FIRST and read its surface-#4 rows. Cross-link with prompt `01`
(the raw-body mount order is jointly owned — confirm with `01`'s fix before
editing `app.ts`).

## Mission

For every Critical/High finding under surface #4 in
`prompts/dockstash-security/findings.md`:
1. Write ≥5 adversarial inputs: a tampered signature, a replayed event, an
   unset-secret request, a forged-signature flood, a parse-before-verify
   regression.
2. Fix: verify-before-parse; `timingSafeEqual`; fail-closed when
   `POLAR_WEBHOOK_SECRET` unset; idempotency record checked before applying
   any lifecycle transition.
3. Add supertest webhook tests: tampered → 4xx + no state change; replayed →
   no double-grant; unset secret → reject.
4. Add a STEP 5 meta-guard: "the webhook verify path uses
   `timingSafeEqual` and parses AFTER verify".

## Operating Constraints

| Rule | Detail |
|---|---|
| Verify-before-parse | HMAC over the RAW body, BEFORE `JSON.parse`. A regression that parses first is a Critical finding. |
| Fail-closed on missing secret | When `POLAR_WEBHOOK_SECRET` is UNSET, the webhook REJECTS (401/500 per convention) — it does NOT skip verification. A skip-on-missing-secret is Critical. |
| timingSafeEqual | Signature comparison is `crypto.timingSafeEqual(a, b)` after a length guard. Never `===`/`!=`/`==` on a signature. |
| Idempotency | `webhook-event.model` records processed events; a replayed event id is detected and skipped (no double-grant, no double-apply). Refunds/cancellations post linked state, never a silent hard delete of history. |
| Rate-limit before raw | `createWebhookRateLimiter()` runs BEFORE `express.raw()`; the limiter never consumes/alters the bytes used for HMAC. |
| Replay-window tolerance | Standard-Webhooks includes a timestamp; reject events outside the tolerance window (e.g. >5 min) to narrow replay. |
| Money server-derived | Order/subscription amounts come from the webhook payload + tier catalog, not a client body. (Cap math is surface #3.) |
| Docker-only | All build/test cmds in Docker. |
| i18n 7 locales | Any new error response is a key in ALL 7 dictionaries. (Most webhook errors are generic 400/401 with no body — fine.) |
| No control weakened | Never disable a coverage gate or lint rule to pass a test. |

## Phases

### Phase 0 — Map
- 0.1 Read `prompts/dockstash-security/findings.md` surface-#4 rows. Read
  `prompts/SECURITY.md` § "4. WEBHOOK & PAYMENT INTEGRITY".
- 0.2 Read `modules/billing/webhook/{verify,ingest,handler}.ts` end-to-end.
  Read `modules/billing/providers/polar/*`. Read
  `modules/billing/order/{subscription,customer,webhook-event}.model.ts`.
- 0.3 In `server/src/app.ts`, confirm the webhook route mount order relative
  to `express.json()` AND relative to `createWebhookRateLimiter()`. Cross-
  check with prompt `01`.
- 0.4 Read `server/src/config/env.ts` — is `POLAR_WEBHOOK_SECRET` optional in
  the zod schema? If yes, confirm the handler treats absence as fail-closed.

### Phase 1 — Adversarial inputs (STEP 2)
For each finding, write ≥5 inputs:
- A `POST /api/billing/webhook` with a body whose signature was computed over
  DIFFERENT bytes than the handler sees (parse-before-verify regression) —
  assert 401 today (if regressed), 401 after fix; assert no state change.
- A replayed event id (an event already processed) — assert NO double-grant
  of subscription, NO double-apply of lifecycle transition.
- A request with `POLAR_WEBHOOK_SECRET` unset in env — assert the handler
  REJECTS (fail-closed), does NOT skip verification.
- A flood of forged signatures (1000 rapid requests) — assert the rate
  limiter engages before CPU/DB exhaustion and the limiter does not consume
  the body.
- A signature compared with `===` (regression) — assert the test for
  `timingSafeEqual` presence in the verify path fails today (if regressed),
  passes after fix.
- An event with a timestamp outside the replay tolerance window — assert
  rejection.

### Phase 2 — Fix (STEP 3)
- 2.1 **Verify-before-parse**: the verify step reads the raw buffer (the
  `express.raw`-populated `req.body`), computes the HMAC, and calls
  `timingSafeEqual` BEFORE any `JSON.parse`. If the current code parses first,
  restructure: `const verified = verifyWebhook(req.body, sig, secret); if
  (!verified) return 401; const event = JSON.parse(req.body.toString())`.
- 2.2 **Fail-closed**: in the verify entrypoint, if `secret` is empty/undefined,
  REJECT (throw/return 401) — do NOT default to a no-op verify. Add a test
  that fails if the handler ever returns 200 with an unset secret.
- 2.3 **timingSafeEqual**: replace any `===`/`!=` on the signature with
  ```
  const a = Buffer.from(expectedSig);
  const b = Buffer.from(providedSig);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
  ```
  Length-mismatch returns false but STILL pays a comparable cost (consider a
  fixed-length dummy compare to flatten timing — match what `require-agent-
  auth` already does for symmetry).
- 2.4 **Idempotency**: before applying a lifecycle transition, check
  `webhook-event.model` for the event id; if present, return 200 (ack) with NO
  state change. Insert the event id atomically (unique index on `eventId`) so
  two concurrent deliveries of the same event cannot both pass.
- 2.5 **Replay window**: reject events whose `webhook-id`/timestamp header is
  older than the tolerance (e.g. env-configured `WEBHOOK_TOLERANCE_SECONDS`,
  default 300). Add the var to the zod schema + `.env.example`.
- 2.6 **Rate-limit-before-raw**: confirm `createWebhookRateLimiter()` is
  mounted BEFORE `express.raw()` on the route (it must not consume the body).
  Cross-check with prompt `01` if the order also needs the raw-body-above-
  json fix.
- 2.7 **No silent hard delete**: refunds/cancellations post a linked state
  record (e.g. a `refund` row referencing the original order); they NEVER
  hard-delete the order/subscription history.

### Phase 2 — Reference fix shapes (illustrative — match the repo's real types)

```ts
// verify.ts — verify RAW bytes BEFORE JSON.parse; fail closed on missing secret
export function verifyWebhook(rawBody: Buffer, headers: Record<string, string>): PolarEvent {
  const secret = env.POLAR_WEBHOOK_SECRET;
  if (!secret) throw HttpError.unauthorized();            // FAIL CLOSED — never skip verification

  const expected = standardWebhookSign(
    secret, headers['webhook-id'], headers['webhook-timestamp'], rawBody,
  );
  const a = Buffer.from(expected);
  const b = Buffer.from(headers['webhook-signature'] ?? '');
  // length guard first, THEN constant-time compare (never ===)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw HttpError.unauthorized();

  const skew = Math.abs(Date.now() / 1000 - Number(headers['webhook-timestamp']));
  if (skew > env.WEBHOOK_TOLERANCE_SECONDS) throw HttpError.unauthorized();  // narrow replay window

  return JSON.parse(rawBody.toString('utf8'));            // parse ONLY after verify succeeds
}

// ingest.ts — idempotency via a unique index on eventId: insert-or-ack
try {
  await WebhookEvent.create({ eventId: event.id });       // unique index rejects a replay
} catch (err) {
  if (isDuplicateKeyError(err)) return res.status(200).end();  // already processed → ack, NO re-grant
  throw err;
}
await applyLifecycleTransition(event);                    // runs exactly once per event id
```

### Phase 3 — Tests (STEP 4)
Server (vitest node, supertest against `createApp()`, mongodb-memory-server):
- **Tampered signature**: a request with a signature that does not match the
  body → 401 (or 400) AND no state change (assert the relevant collection is
  unchanged). State fail-before status.
- **Valid signature**: a request with a correct signature → 200 AND the
  expected state transition applied exactly once.
- **Replay**: the same valid event delivered twice → first 200 + state
  applied; second 200 + NO additional state change (idempotent).
- **Unset secret**: with `POLAR_WEBHOOK_SECRET` cleared from env (per-test
  override of the zod-parsed config), a webhook request → 401/reject, NEVER
  200. This is the fail-closed proof.
- **Forged flood**: 1000 rapid forged-signature requests → the rate limiter
  returns 429 within the configured window; no row is ever inserted; the body
  is not consumed by the limiter (assert the raw buffer reaches a downstream
  spy when the limiter passes).
- **timingSafeEqual presence**: a static test asserting the verify module
  source references `timingSafeEqual` (regex over the file) — fails on
  regression to `===`.
- **Replay window**: an event with a timestamp skew > tolerance → 401.
- **No hard delete**: a `subscription.deleted` (or refund) event posts a
  linked record and does NOT remove the original order row.

### Phase 4 — Prevent (STEP 5)
- a) **Meta-test**: "the webhook verify module (a) references
  `timingSafeEqual`, (b) calls `JSON.parse` AFTER the verify call, (c)
  rejects when the configured secret is empty". A regex/AST scan of the verify
  module that fails on regression.
- b) **Meta-test**: "the webhook route in `app.ts` is mounted with
  `createWebhookRateLimiter()` BEFORE `express.raw(...)` and the route is
  ABOVE `app.use(express.json(...))`". A static scan of `createApp`.
- c) **ESLint `no-restricted-syntax`**: ban `===`/`==`/`!=` comparisons where
  one operand is named `*signature*`/`*sig*`/`*hmac*` in
  `modules/billing/webhook/**` (best-effort; the meta-test is the strong
  guard).
- d) Add `.claude/rules/webhook-verify-before-parse.md` (MANDATORY REQUIREMENT
  header, Correct/Forbidden examples, Validation Checklist) and a one-line
  entry in `.claude/rules/README.md`. Update `CLAUDE.md` §5. Cross-reference
  `docs/polar-billing-and-webhooks.en.md`.

## Coverage & Success Gate — NON-NEGOTIABLE

This surface is DONE only when, **inside Docker**, the suite is 100% passing and
v8 coverage is **100% on lines / branches / functions / statements** for the code
this prompt touched:

```
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm \
  npx vitest run --coverage
```

Hard requirements:
- Every fix ships a test that FAILS before the change and PASSES after — stated per test.
- Cover EVERY verify branch: valid sig (200), tampered sig (401), unset secret (401,
  fail-closed), replay outside window (401), duplicate eventId (200 ack, no re-grant).
  The `isDuplicateKeyError` catch and the length-mismatch branch must both be hit.
- No `.skip`/`.only`, no lowered `vitest.config.ts` thresholds, no `/* c8 ignore */`,
  no `eslint-disable`, no `@ts-ignore` to reach green (`docs/ci-gates.en.md`).
- If a line is genuinely unreachable, delete/refactor it — never ignore it.
- The 7-locale i18n parity test stays green (every new key in en/ar/fr/de/es/ru/zh).
- Re-run until green AND 100%. A red or sub-100% run is not "almost done" — it is not done.

## i18n

Most webhook errors are bodyless 400/401 responses — no key needed. If a
localized error body is added (e.g. for an admin-facing replay-window reject),
the key lands in ALL 7 server dictionaries. Parity test green.

## Documentation

- `docs/polar-billing-and-webhooks.en.md` — annotate verify-before-parse,
  fail-closed-on-missing-secret, `timingSafeEqual`, idempotency via
  `webhook-event.model`, the replay tolerance window, and the rate-limiter-
  before-raw mount.
- `docs/security-model.en.md` — note that the webhook is fail-closed and
  replay-protected.
- `.env.example` — document `WEBHOOK_TOLERANCE_SECONDS` (root only).
- `CLAUDE.md` §5 — reference the new rule file.

## Agents & Skills

- **Agents:** `security-review-specialist` (primary); `backend-dev` (ingest
  plumbing, idempotency record).
- **Skills:** `/security-review` `api` mode (deep semantic pass — **required**
  before merge); `payment-orchestrator` (provider-abstraction discipline);
  `code-review` (final diff pass — assert no `===` on a signature, no
  parse-before-verify, no skip-on-missing-secret).

## Idempotency Contract

Re-running MUST NOT: wrap the verify in a second `timingSafeEqual` (detect and
skip), add a second idempotency check, re-create the `eventId` unique index,
re-add the replay-window reject, or duplicate the meta-tests/ESLint rule.
Detect existing controls and reconcile in place. A re-run that finds the
surface clean appends "re-verified YYYY-MM-DD — surface #4 clean" to
`findings.md`. Findings fixed here are annotated with `— FIXED at file:line
(prompt 04)` for `09`'s report.
