# Surface #1 — Authentication & Session (Passport JWT) — Build Prompt

> **Closes findings under threat surface #1 of `prompts/SECURITY.md`.** Owns
> the verify-before-parse webhook mount, the `algorithms:['HS256']` pin on the
> JWT strategy, CSRF-bearer-exemption correctness, rate-limiter coverage, and
> the live superadmin OTP gate. Implements STEP 2 (adversarial inputs) →
> STEP 3 (fix) → STEP 4 (test) → STEP 5 (prevent) for this surface only.

---

## Agent

`security-review-specialist` (`.claude/agents/security/security-review-
specialist.md`) — Edit/Bash enabled for the fix+test steps. Adapted from
Anthropic's `claude-code-security-review`. Coordinate with `typescript-pro`
for the strategy/middleware typing. Run `security-auditor`'s `00-recon-
findings` FIRST and read its surface-#1 rows before editing.

## Mission

For every Critical/High finding under surface #1 in
`prompts/dockstash-security/findings.md`:
1. Write at least five realistic adversarial inputs that trigger it.
2. Implement the minimal correct fix matching existing conventions.
3. Add supertest integration tests that FAIL before the fix and PASS after.
4. Add a STEP 5 guard (preferred: a meta-test or ESLint rule) so the class of
   bug cannot silently return.

Surface #1 covers: the Polar webhook raw-body mount order in `app.ts`; the
Passport `'jwt'` strategy HS256 pin; password/token storage (bcryptjs,
CSPRNG+SHA-256-at-rest, bounded TTL, non-enumerating); CORS (`credentials:true`
to `env.CLIENT_URL` only); CSRF double-submit with bearer exemption; the four
rate limiters (auth/webhook/contact/agent) and their mount order vs the OAuth
public probe; the superadmin email-OTP step-up gate.

## Operating Constraints

| Rule | Detail |
|---|---|
| Verify-before-parse | If the webhook raw-body route is mis-ordered (after `express.json()`), MOVE it above — never weaken HMAC verification to "make it work". The raw-body handler must receive the un-parsed buffer. |
| Algorithms pin | The JWT strategy pins `algorithms: ['HS256']`. A second `jsonwebtoken.verify` anywhere with a loose/missing `algorithms` is a fix-now finding — do NOT add `none`/`RS256` to "support another issuer". |
| No hand-parsed tokens | Identity is read ONLY via Passport `'jwt'` in `require-auth.ts`. Flag (and remove) any hand-parsed JWT, any identity read off `req.cookies`, any second verify path. |
| Non-enumerating | Login/reset/resend return the SAME generic localized error for "unknown email" and "wrong password". Forgot-password does not reveal whether the email exists. |
| CSRF exemption is bearer-only | `requireCsrf` exempts requests bearing an `Authorization` header. Do NOT extend the exemption to cookie-only requests. Confirm the CSRF cookie's `secure:true` in production (`NODE_ENV==='production'`). |
| Rate-limit ordering | Credential POSTs (sign-in/up/reset) MUST sit behind `createAuthRateLimiter`. The OAuth capability probe (`oauthPublicRouter`) is the ONLY intentionally-exempt surface — confirm it stays read-only. |
| OTP gate is live | The superadmin OTP challenge must be in the live login path (issuing NO JWT until verified), not merely defined in `login-otp.service`. |
| Docker-only | Every build/test cmd in `docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm …`. Never bare `npm`/`node`/`npx`. |
| i18n 7 locales | Every new/changed user-facing message is a key present in ALL of `en, ar, fr, de, es, ru, zh`. Server dicts under `shared/i18n/`, client under its locale files. Parity tests green. |
| No control weakened | Never disable helmet/CORS/CSRF/rate-limit/coverage/lint to make a test pass. If a test fails, the fix is wrong. |

## Phases

### Phase 0 — Map
- 0.1 Read `prompts/dockstash-security/findings.md` surface-#1 rows. Read
  `prompts/SECURITY.md` § "1. AUTHENTICATION & SESSION" in full.
- 0.2 Read `server/src/app.ts` `createApp()` — confirm the EXACT middleware
  order (`requestId → pinoHttp → … → express.json → cors → passport.initialize
  → routes → notFound → errorHandler`) and where the Polar webhook raw-body
  route is mounted relative to `express.json()`. Record current line numbers.
- 0.3 Read `server/src/modules/auth/passport.strategies.ts` — the `'jwt'`
  strategy `verify` and its `jsonwebtoken.verify` call. Confirm
  `algorithms:['HS256']`. Read `shared/middleware/require-auth.ts`,
  `require-role.ts`.
- 0.4 Read `shared/middleware/{csrf,rate-limit,security-headers,no-store}.ts`,
  `config/passport.ts`, `config/logger.ts` (redaction list).
- 0.5 Read `modules/auth/{login-otp.service,trusted-device.model,auth.service,
  oauth/}`. Read `modules/superadmin/superadmin.seed.ts`.

### Phase 1 — Adversarial inputs (STEP 2)
For each Critical/High finding, write ≥5 realistic inputs into the test
fixtures. Examples (adapt to actual findings):
- A `POST /api/billing/webhook` sent AFTER `express.json()` has consumed the
  body, with a valid Polar signature computed over the ORIGINAL bytes — assert
  the handler sees an empty buffer and the HMAC fails (today: passes against
  empty buffer if not fixed).
- A forged JWT with `alg: "none"` and `alg: "HS256"-using-RS256-public-key-as-
  HMAC-secret` confusion variants.
- A second cookie-authenticated mutating route (`POST /api/…`) with NO
  `Authorization` header and NO CSRF token — assert 403 today (finding), 403
  after fix.
- 1000 rapid `POST /api/auth/login` from one IP — assert the limiter engages
  within the configured window and the OAuth public probe is NOT a bypass.
- A superadmin login from a brand-new user-agent that skips the OTP challenge
  (if the gate is mis-wired) — assert NO JWT is issued until OTP verifies.

### Phase 2 — Fix (STEP 3)
- 2.1 **Webhook raw-body order** — in `app.ts`, mount
  `app.post('/api/billing/webhook', createWebhookRateLimiter(),
  express.raw({type:'application/json'}), webhookHandler)` BEFORE
  `app.use(express.json(...))`. Do not change the handler's signature. (If
  already correctly ordered, demote the finding and move on.)
- 2.2 **JWT algorithms pin** — confirm `passport.strategies.ts` calls
  `jwt.verify(token, SECRET, { algorithms: ['HS256'] })`. Remove any
  fallback/loose verify. Flag (do not auto-fix) any second `jsonwebtoken.
  verify` with a loose `algorithms` — surface to `04` if it's webhook-
  adjacent.
- 2.3 **CSRF + cookie `secure`** — confirm `csrf.ts` exempts ONLY requests
  with an `Authorization` header; confirm the CSRF cookie sets `secure:
  NODE_ENV === 'production'`. Mount `requireCsrf` on every cookie-authenticated
  mutating surface that lacks it (do NOT add it to bearer-only routes).
- 2.4 **Rate-limit coverage** — every credential POST (`/api/auth/login`,
  `/login-otp`, `/register`, `/reset-password`, `/resend-verification`) sits
  behind `createAuthRateLimiter`. Confirm the OAuth public probe stays
  read-only and BEFORE the limiter intentionally.
- 2.5 **Superadmin OTP gate** — confirm the OTP challenge is in the live login
  path: untrusted-device login returns a "challenge required" response and
  issues NO JWT until `POST /api/auth/login-otp/verify` succeeds. If the gate
  is defined but bypassed, wire it.
- 2.6 **Token storage** — confirm email-verify/password-reset tokens are
  CSPRNG + SHA-256-hashed at rest with bounded TTL; confirm forgot-password
  /resend are non-enumerating (same localized response whether or not the
  email exists).
- 2.7 **Redaction** — extend `config/logger.ts` pino redaction paths to cover
  any surface-#1 secret the audit found un-redacted (`SUPERADMIN_PASSWORD`,
  CSRF secrets, OTP codes, password-reset tokens).

### Phase 3 — Tests (STEP 4)
Server (`server/`, vitest node, `fileParallelism:false`, v8 coverage; supertest
against `createApp()`; `startMemoryMongo`/`stopMemoryMongo`/`clearCollections`):
- **Webhook raw-body**: a request whose body would be consumed by
  `express.json()` still reaches the handler as the original buffer; HMAC over
  the original bytes verifies; HMAC over an empty buffer rejects. (State which
  fail before the fix.)
- **JWT alg pin**: `alg:none` token rejected with 401; HS256-with-RS256-public-
  key confusion rejected with 401; valid HS256 token accepted.
- **CSRF**: cookie-authenticated mutating POST without CSRF token → 403; with
  valid token → passes; bearer-authenticated POST → passes without CSRF token
  (exemption holds).
- **CSRF cookie `secure`**: in `NODE_ENV='production'` the cookie has
  `secure:true`; in dev it does not.
- **Rate-limit**: N+1 rapid credential POSTs from one IP → 429 with
  `Retry-After`; the OAuth public probe (`GET /api/auth/oauth/…`) is NOT
  limited (intentional) but a forged `POST` to a credential route IS.
- **Superadmin OTP**: login from untrusted device returns challenge-required,
  NO JWT in the response body/cookie; only after `verify` does the JWT issue.
- **Non-enumeration**: `/forgot-password` with unknown email returns the same
  localized message + same timing (within tolerance) as a known email.
- **Redaction**: a log line emitted during a login flow does not contain the
  password, JWT, OTP, or `SUPERADMIN_PASSWORD` (assert via a captured pino
  destination stream).

### Phase 4 — Prevent (STEP 5)
Preferred: an **executable** guard over prose.
- a) **Meta-test** under `server/src/shared/middleware/` (or a repo-wide
  `__tests__/security-meta.test.ts`): "every router mounted in `app.ts` whose
  path starts with `/api/auth/` AND handles a mutating verb is behind
  `createAuthRateLimiter`" — scan the mount table, fail if one is missing.
- b) **Meta-test**: "the Polar webhook route is declared ABOVE the
  `express.json()` mount in `app.ts` source order" — a static check over the
  `createApp` body (regex/AST) that fails if regressed.
- c) **ESLint `no-restricted-syntax`** rule: ban `jwt.verify(*, *, { algorithms:
  undefined })` and `algorithms: ['none']` — fail the lint gate on regression.
- d) If a `.claude/rules/<topic>.md` is warranted (e.g.
  `passport-jwt-algorithms-pin.md`), follow the existing format (MANDATORY
  REQUIREMENT header, Correct/Forbidden examples, Validation Checklist) and
  add a one-line entry in `.claude/rules/README.md`. Update `CLAUDE.md` §5 if
  load-bearing.

## i18n

Every new/changed user-facing error (CSRF-missing, rate-limited,
challenge-required, alg-rejected generic 401, non-enumerating forgot-password
response) is a key present in ALL 7 server dictionaries under `shared/i18n/`
(`en, ar, fr, de, es, ru, zh`) and surfaced in the client locale files where
the client renders them. RTL for `ar` (`rtl-support-arabic.md`). Key-parity
test stays green. No hardcoded user-facing strings.

## Documentation

- `docs/security-model.en.md` — annotate the verify-before-parse mount order,
  the HS256 pin, the CSRF bearer exemption, and the OTP gate (do not rewrite
  the doc; add a "Controls asserted" subsection cross-linking the new
  meta-tests).
- `CLAUDE.md` §5 — if a new rule file was added, reference it.
- `.env.example` — if any knob was added (e.g. a CSRF cookie name, an OTP
  TTL var), document it. Root only (`environment-variables.md`).

## Agents & Skills

- **Agents:** `security-review-specialist` (primary — fix + test + prevent);
  `typescript-pro` (strategy/middleware typing).
- **Skills:** `/security-review` in `auth` mode (deep semantic pass on the
  auth surface — **required** before merge); `backend-i18n` (7-locale parity);
  `code-review` (final diff pass — assert no `algorithms:['none']`, no
  reflected CORS origin, no `StrictHostKeyChecking=no` drift into auth).

## Idempotency Contract

Re-running MUST NOT: re-order the webhook route if already above
`express.json()` (detect and skip), add `requireCsrf` twice to the same
router, mount `createAuthRateLimiter` twice, re-add the algorithms pin if
present, re-create the OTP gate if live, duplicate the redaction paths, or
re-declare the meta-tests/ESLint rule. Detect existing controls and reconcile
in place — each guard is asserted exactly once on every run. A re-run that
finds the surface clean appends "re-verified YYYY-MM-DD — surface #1 clean" to
`findings.md` and exits.
