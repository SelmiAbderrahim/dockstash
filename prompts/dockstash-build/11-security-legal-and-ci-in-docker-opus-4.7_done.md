# Security, Legal & CI-in-Docker — Build Prompt

> **The hardening pass that makes Dockstash shippable** — app-layer hardening
> (rate-limit, helmet, locked CORS, CSRF, zod-on-every-mutation), transport/key
> trust (SSH host-key pinning, restic-password escrow, master-key rotation),
> Docker-socket least-privilege, GDPR data-export + right-to-deletion with a
> grace-period purge and a final Resend warning, a legal-hold flag that retention
> must respect — and a **CI/CD pipeline running in Docker** (the repo has none)
> that gates on typecheck → lint → tests → **100% coverage** → `npm audit`
> zero-high.

---

## Agent

`security-auditor` (primary — owns the app-layer hardening, the SSH host-key
pinning, the threat-model doc, and the GDPR data-rights module). Coordinate with
`cicd-engineer` (the Docker CI pipeline + coverage/audit gates) and
`dependency-manager` (the `npm audit --audit-level=high` zero-high gate + pinned
deps).

This is build-phase 8 in `IDEA.md` ("Security + legal pass: secret encryption +
rotation/escrow, rate-limit/helmet/CSRF, SSH host-key pinning, GDPR export/delete;
CI in Docker with `npm audit` + 100% coverage gates"). It depends on prompts `00`
(Docker stack + `docker-socket-proxy`), `01` (i18n), `02` (`server/src/shared/
crypto/` AES-256-GCM + `keyVersion` + `MASTER_ENCRYPTION_KEY`), `03` (`modules/
backups/` + `SshTransport`), `05` (retention/prune jobs), `07` (billing/Resend),
and `09` (bootstrap recovery). It is the **final** prompt and creates the CI that
gates everything before it.

## Mission

`IDEA.md` §1 (app-layer hardening, transport/key trust, threat model), §8 (data
lifecycle & legal / GDPR), and §2 (CI/CD pipeline, 100% coverage + npm-audit gates)
define this pass. Deliver:

1. **App-layer hardening** — `express-rate-limit` on auth + webhook routes,
   `helmet` headers, CORS locked to `env.CLIENT_URL` only, CSRF protection on the
   cookie-borne JWT, and an audit that **every** mutating route has zod body
   validation.
2. **Transport/key trust** — SSH **host-key pinning** for the storage VPS (pin in
   `known_hosts`, reject on mismatch), restic-password **escrow** (show once,
   confirm saved, store only AES-256-GCM copy), and a **master-key rotation**
   re-encrypt path with `keyVersion`.
3. **Docker socket least-privilege** — confirm the `api` reaches Docker only via
   `docker-socket-proxy` (prompt `00`), drop unused Linux capabilities, and
   document the agent's blast radius / threat model.
4. **Data lifecycle & legal** — GDPR data **export** + right-to-**deletion**
   (account deletion → backup purge after a grace period with a final Resend
   warning email), a **legal-hold** flag that retention auto-prune must respect,
   and a data-residency doc.
5. **CI/CD pipeline (new) running in Docker** — typecheck → lint → unit+integration
   tests → **100% coverage gate** (v8) → `npm audit --audit-level=high` zero-high
   gate; the build fails below threshold or on a new high/critical advisory.

## Operating Constraints

| Rule | Detail |
|---|---|
| Verify-before-parse stays intact | Rate-limiting and helmet must not break the Polar webhook's raw-body signature verification (`express.raw` before `express.json`, prompt `07`). Apply rate-limit to the webhook route **without** consuming/altering the raw bytes before HMAC verification. Preserve the `app.ts` middleware order. |
| CORS locked | CORS `origin` is **exactly** `env.CLIENT_URL` with `credentials: true` — no wildcard, no reflected origin (`site-url-env-pattern.md`, `IDEA.md` §1). A foreign origin is rejected. |
| CSRF on cookie auth | JWT-in-cookie → CSRF applies. Use double-submit token **or** `SameSite=strict` cookies; document the choice. Mutating routes reject a missing/invalid CSRF token. Bearer-token API calls (if any) are exempt and documented. |
| Host-key pinning | The storage-VPS host key is pinned in `known_hosts`; the `SshTransport` (prompt `03`) **rejects on mismatch** — no `StrictHostKeyChecking=no`, no auto-accept. A changed host key fails the backup channel loudly (`IDEA.md` §1 transport trust). |
| Secrets never plaintext | Escrow stores only the AES-256-GCM-encrypted restic password (prompt `02`); rotation decrypts-with-old → re-encrypts-with-new → atomic swap, bumping `keyVersion`. No decrypted secret is logged or returned (`IDEA.md` §1). |
| Legal hold beats retention | The retention `forget --prune` job (prompt `05`) MUST skip any project/snapshot under a `legalHold` flag — auto-prune never deletes held data (`IDEA.md` §8). |
| No data loss on deletion path | Account deletion **schedules** a repo purge after a grace window with a final Resend warning email — it does not purge synchronously (`IDEA.md` §8). |
| Auth + ownership | Every new route behind `requireAuth`; data-export/deletion scoped to the calling `userId`; `HttpError.forbidden()` on cross-user access. |
| Env from root only | New vars (CSRF/rate-limit knobs, grace-period hours, `keyVersion`) flow through `server/src/config/env.ts` zod schema + `.env.example`. No subdirectory `.env`. |
| Coverage gate is real | Enable the v8 **100% threshold** on lines/branches/functions/statements in **both** `server/vitest.config.ts` and `client/vitest.config.ts`; CI fails below it. The gate is inert without a runner — the CI job is the runner. |
| Excluded | No WAF, no SIEM, no pen-test engagement, no tax engine (Polar is MoR, prompt `07`). |

## Phases

### Phase 0 — Map the model
- 0.1 Read `server/src/app.ts` `createApp()` — the exact middleware order
  (`requestId → pinoHttp → express.json({limit:'1mb'}) → cors → passport.initialize
  → routes → notFound → errorHandler`) and the webhook raw-body mount from prompt
  `07`. New middleware must slot in without breaking verify-before-parse.
- 0.2 Read `server/src/modules/auth/` (login/register routes — rate-limit targets),
  the billing webhook route (prompt `07`), `shared/middleware/require-auth.ts`,
  `shared/utils/http-error.ts`, and the i18n `t(key, vars)` helper (prompt `01`).
- 0.3 Read `server/src/shared/crypto/` (prompt `02` — `encryptSecret`/
  `decryptSecret`, the stored `keyVersion`) and `modules/backups/
  backups.boundaries.ts` (`SshTransport`, prompt `03`) — the rotation + host-key
  pinning touch these.
- 0.4 Read the retention/prune job (prompt `05`) — the legal-hold check inserts
  here. Read the `User` model + `modules/communication/` Resend wrapper (prompt
  `07`) — deletion warning emails flow through it.
- 0.5 Read `server/vitest.config.ts` and `client/vitest.config.ts` (current
  coverage config) and confirm the repo has **no** CI workflow yet
  (`.github/workflows/`).

### Phase 1 — App-layer hardening
- 1.1 Add `helmet` and `express-rate-limit` (pinned, public-npm). Apply `helmet()`
  early in `createApp()` (after `requestId`, before routes); apply a strict
  rate-limiter to `/api/auth/*` (login/register) and the webhook route — without
  disturbing raw-body verification.
- 1.2 Confirm/tighten CORS to `origin: env.CLIENT_URL, credentials: true` only.
- 1.3 Add CSRF protection for the cookie-borne JWT (double-submit token or
  `SameSite=strict`); add a `requireCsrf` middleware (or cookie config) applied to
  mutating routes; expose a CSRF-token endpoint if using double-submit.
- 1.4 **Audit** every mutating route across `modules/*` for zod body validation;
  add the missing schemas. Document the audit result in the PR/changelog.

### Phase 2 — Transport & key trust
- 2.1 SSH host-key pinning in the `SshTransport` impl: on first storage setup,
  capture and store the host key (pinned in `known_hosts`); on every connection,
  **reject on mismatch** with a localized `HttpError`. No auto-accept, no
  `StrictHostKeyChecking=no`.
- 2.2 Restic-password **escrow** at storage setup: show once (UI is prompt `10`),
  server stores only the AES-256-GCM ciphertext + `keyVersion`; add the
  server-side enforcement that the plaintext is never persisted or returned.
- 2.3 **Master-key rotation** path: a guarded admin operation that decrypts every
  encrypted secret with the old `MASTER_ENCRYPTION_KEY`, re-encrypts with the new,
  bumps `keyVersion`, and swaps atomically (all-or-nothing; failure rolls back).

### Phase 3 — Docker socket least-privilege & threat model
- 3.1 Confirm the `api` service uses `DOCKER_HOST=tcp://docker-socket-proxy:2375`
  (prompt `00`) and never bind-mounts the raw socket; tighten the proxy to only
  the needed endpoints (`CONTAINERS`/`EXEC`/`INFO`).
- 3.2 In `docker-compose.yml`, drop unused Linux capabilities on the `api`
  container (`cap_drop: [ALL]` + add back only what restic/dockerode need);
  `no-new-privileges`.
- 3.3 Author the **threat model / blast-radius** doc: the agent is root-equivalent
  on the host (reads `/var/www`, holds the socket); mitigations (proxy, capability
  drop, crown-jewel treatment, multi-tenant path-traversal guards).

### Phase 4 — Data lifecycle & legal (GDPR)
New `server/src/modules/legal/` (or extend `users`):
- 4.1 **GDPR export** — `POST /api/legal/export` returns the user's data (account,
  projects, schedules, history; secrets as ciphertext only, reusing prompt `09`
  envelope discipline). `userId`-scoped, behind `requireAuth`.
- 4.2 **Right-to-deletion** — `POST /api/legal/delete-account` schedules account
  deletion: mark the account, schedule a **repo purge after a grace window**
  (env-configured hours), and send a **final Resend warning email** (prompt `07`
  communication module). The purge is a serialized job (prompt `05` queue), never
  synchronous.
- 4.3 **Legal hold** — a `legalHold` boolean on `Project` (or a `LegalHold`
  record); the retention `forget --prune` job (prompt `05`) **skips** held
  projects/snapshots. A held account's deletion purge also respects the hold.
- 4.4 Data-residency: document where the storage VPS lives; note the Business-tier
  region option (no code beyond the doc unless trivial).

### Phase 5 — CI/CD pipeline in Docker
- 5.1 Set the v8 **100% coverage threshold** (lines/branches/functions/statements)
  in **both** `server/vitest.config.ts` and `client/vitest.config.ts`.
- 5.2 Add `.github/workflows/ci.yml` (or equivalent) that runs **in Docker**
  (containerized jobs for prod parity, `IDEA.md` §2/§9): stages
  `typecheck → lint → unit+integration tests → coverage gate → npm audit`. Server
  tests use the existing `mongodb-memory-server` harness; the audit stage runs
  `npm audit --audit-level=high` on both `client/` and `server/` and **fails on
  any high/critical advisory**.
- 5.3 The pipeline fails the build below the coverage threshold or on a new
  high/critical advisory. Pin all new deps from public npm.

### Tests
Server (`server/`, vitest node, `fileParallelism:false`, v8 coverage **100% gate**;
supertest against `createApp()`; `startMemoryMongo`/`stopMemoryMongo`/
`clearCollections`):
- **Rate-limit**: after N rapid `/api/auth/login` attempts the limiter returns
  `429`; the webhook route is limited without breaking signature verification.
- **Helmet**: security headers present on responses (assert key headers).
- **CORS**: a request from a foreign origin is rejected; `env.CLIENT_URL` is
  allowed with credentials.
- **CSRF**: a mutating request with a missing/invalid CSRF token is rejected; a
  valid token (or same-site request) passes.
- **Host-key pinning**: `SshTransport` with a mismatched host key is rejected
  (mocked); a matching pinned key connects.
- **Rotation/escrow**: rotation re-encrypts all secrets, bumps `keyVersion`, and
  a rollback on mid-rotation failure leaves the old ciphertext intact; the restic
  password is never returned/logged in plaintext.
- **GDPR**: export returns the user's data (secrets as ciphertext only); a
  cross-user export is `forbidden`. `delete-account` schedules a purge after the
  grace window and enqueues the final Resend warning (assert via mocked send) —
  not synchronous.
- **Legal hold**: the retention prune job skips a `legalHold` project (assert no
  `forget --prune` issued for it); a non-held project is pruned.
- **Coverage/audit gates**: a config assertion that both vitest configs declare
  100% thresholds; an assertion/check that the CI defines the `npm audit
  --audit-level=high` gate.
- **Injection/validation**: the route audit holds — every mutating route rejects a
  malformed body via zod.

### i18n
All new user-facing strings (CSRF/rate-limit errors, host-key-mismatch, rotation,
GDPR export/deletion confirmations, the deletion warning email) localized via the
prompt-`01` `t(key, vars)` helper in the user's language; client copy (prompt `10`
surfaces) via i18next. **7 locales** (en, ar, fr, de, es, ru, zh), auto-detect,
**ar RTL**. Key-parity test across all 7 dictionaries (presence + placeholder
parity). No hardcoded user-facing strings.

### Documentation
- `/docs` (all 7 languages where user-facing):
  - **"Security model / threat model"** — app-layer hardening, the agent blast
    radius, socket-proxy least-privilege, host-key pinning, escrow + master-key
    rotation.
  - **"Data rights & account deletion"** — GDPR export, right-to-deletion, the
    grace-period purge + final warning email, legal hold, data residency; also
    surface the deletion policy in **Terms**.
  - Cross-link the prompt-`09` **bootstrap-recovery** runbook.
  - **"CI gates"** — typecheck/lint/test/100%-coverage/`npm audit` stages.
- `CLAUDE.md`: note (do **not** rewrite product code) where the security posture
  changed — Docker is first-class, the `npm audit` zero-high gate and 100%
  coverage gate now exist, CORS/CSRF/helmet/rate-limit are enforced.
- `.env.example`: every new var (grace-period hours, CSRF/rate-limit knobs)
  documented; root only.

## Agents & Skills

- **Agents:** `security-auditor` (primary — hardening, host-key pinning, threat
  model, GDPR); `cicd-engineer` (Docker CI + coverage/audit gates);
  `dependency-manager` (`npm audit` zero-high gate, pinned deps).
- **Skills:** `security-review` (deep semantic pass over the hardening + secret
  handling — **required** before merge); `lint` (format/lint/type-check, wired
  into CI); `spec-driven-development` (spec the legal module first);
  `docker-workflow-automation` (CI-in-Docker, capability drop, socket-proxy);
  `code-review` (final pass — assert no plaintext secret, no CORS wildcard, no
  `StrictHostKeyChecking=no`).

## Idempotency Contract

Re-running MUST NOT: add `helmet`/rate-limit/CSRF middleware twice (detect
already-applied and skip), duplicate the CORS config, re-pin an already-pinned host
key, re-add env vars already in `config/env.ts`/`.env.example`, create a second
`modules/legal/` or duplicate the `legalHold` field/migration, register a second
deletion-purge or rotation job, re-declare the vitest coverage thresholds twice, or
add a second `ci.yml` / duplicate CI stage. Detect existing middleware, routes,
env, jobs, gates, and the workflow file and reconcile **in place** — each gate,
guard, and job is declared exactly once on every run.
