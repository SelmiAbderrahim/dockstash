# Dockstash Security Batch — FINAL REPORT

**Generated:** 2026-07-07 (STEP 6 verify pass, prompt 09)
**Scope:** All 8 threat surfaces from `prompts/SECURITY.md` (S1–S8).
**Method:** re-read `findings.md` end-to-end; spot-verify each `— FIXED at
file:line (prompt NN)` annotation against current code; run the full
Docker toolchain (typecheck → lint → tests → v8 coverage → `npm audit`)
on `server/`, `client/`, `agent/`.
**Verdict (see §3.7):** **OPEN items remain — 5 blockers.**

---

## §3.1 — Findings table (final status)

Grouped Critical → High → Medium → Low. `FIXED at file:line` cells copied
from `findings.md`; `— VERIFIED` appended where prompt 09 confirmed the
cited path holds. `— OPEN` on any regressed/partial fix.

| id | surface | severity | title | final status |
|---|---|---|---|---|
| S7-01 | 7 | Critical | pino logger created with no `redact` | FIXED at `server/src/config/logger.ts:25-90` (prompt 07) — **VERIFIED**: `REDACT_PATHS` exports covers auth/cookie/set-cookie/`*.password`/`token`/`secret`/`privateKey`/`apiKeyHash`/`ciphertext`/`iv`/`authTag`; pino instantiated with `redact:{paths:REDACT_PATHS,censor:'[REDACTED]'}`. |
| S7-02 | 7 | Critical | pinoHttp mounted without req/res redaction | FIXED transitively via S7-01 (prompt 07) — **VERIFIED**: same `logger` instance shared by pinoHttp; paths include `req.headers.authorization`, `req.headers.cookie`, `req.headers["x-csrf-token"]`, `res.headers["set-cookie"]`. |
| S3-01 | 3 | High | `POST /api/backups` create path has no project cap check | FIXED (prompt 03) — **OPEN**: entitlement-meta static test fails (`reserveProjectSlot precedes createProject in backups.controller::create` → -1 index). See §3.6-A. |
| S3-02 | 3 | High | `PATCH /api/scheduler/:id` bypasses schedules-allowed after downgrade | FIXED (prompt 03) — **OPEN**: `entitlement-meta.test.ts > PATCH scheduler re-runs the tier gate` fails (`assertScheduleAllowed` regex miss in `updateSchedule` body). See §3.6-A. |
| S6-01 | 6 | High | SSRF in alert webhook | FIXED at `server/src/modules/alerting/alert.service.ts:42` + `server/src/shared/net/safe-fetch.ts:143` (prompt 06) — **VERIFIED**: `defaultWebhookPoster` routes through `safeFetch`; scheme allowlist + IPv4/IPv6 loopback/private/link-local/metadata block + manual redirect follow with per-hop re-validation + 5-hop cap. |
| S1-02 | 1 | Medium | In-memory rate limiter bypassed across pods | FIXED at `server/src/shared/middleware/rate-limit.ts` + `rate-limit-redis-store.ts` (prompt 01). |
| S3-03 | 3 | Medium | No unique index / atomic guard on Project count → TOCTOU | FIXED (prompt 03) — **OPEN transitively via S3-01**: the atomic-reserve test fails because `reserveProjectSlot` isn't exported from `entitlements.service`. See §3.6-A. |
| S7-03 | 7 | Medium | Self-backup restic password is the raw `MASTER_ENCRYPTION_KEY` | FIXED at `server/src/boot/recovery.ts:90,106` (prompt 07) — **VERIFIED**: `deriveSelfBackupPassword(env.MASTER_ENCRYPTION_KEY)` HMAC-SHA256s the master with label `dockstash:self-backup:v1`; static guard bans `password: env.MASTER_ENCRYPTION_KEY`. |
| S8-01 | 8 | Medium | Legal export includes `repoPasswordEnc` envelope | FIXED-BY-DESIGN (prompt 08) — intent documented at `legal.service.ts:28-31`; envelope only decryptable with master key (never exposed). |
| S8-02 | 8 | Medium | `LOG_LEVEL=trace` echoes bodies verbatim | FIXED transitively via S7-01 (prompt 07 + prompt 08 verify). |
| S1-01 | 1 | Low | Authenticated health routes bypass `requireVerified` | FIXED at `server/src/app.ts` (prompt 01). |
| S1-03 | 1 | Low | Timing enumeration on forgot/resend | FIXED at `server/src/modules/auth/auth.service.ts` via `padAuthTiming` (prompt 01). |
| S2-01 | 2 | Low | 403 vs 404 existence leak | FIXED (prompt 02) — all owner-scoped loaders now return 404 via existence-cloak. |
| S2-02 | 2 | Low | `stampProject` unscoped write | FIXED (prompt 02). |
| S2-03 | 2 | Low | `listProjectJobsHandler` fetches without owner join | FIXED (prompt 02). |
| S7-04 | 7 | Low | `errorHandler` returns `err.stack` in dev responses | FIXED at `server/src/shared/middleware/error-handler.ts` (prompt 07) — **VERIFIED**: no `NODE_ENV === 'development'` stack branch remains. |
| S8-03 | 8 | Low | `ownerOfAgentJob` return trust unverified | FIXED at `server/src/modules/scheduler/scheduler.logstream.ts:60-65` (prompt 08). |

**Surface 4 (Webhook & Payment Integrity — Polar): no findings recon; STEP 5
invariants pinned by prompt 04.**
**Surface 5 (Fleet-Agent Machine Surface): no findings recon; STEP 5
invariants pinned by prompt 05.**

---

## §3.2 — Per-finding fix summary (one line each)

- **S7-01** — pino `redact` allowlist added — `server/src/config/logger.ts:25-90` — prompt 07 — proven by `server/src/config/logger-redaction.test.ts` + `shared/middleware/secrets-meta.test.ts`.
- **S7-02** — same `redact` block covers pinoHttp — `server/src/app.ts:52-57` — prompt 07 — proven by `logger-redaction.test.ts`.
- **S3-01** — API-layer `assertProjectCap`/`reserveProjectSlot` on create — `server/src/modules/backups/backups.controller.ts` — prompt 03 — **static test failing** (see §3.6-A).
- **S3-02** — `assertScheduleAllowed` in `updateSchedule` on cron/enable transitions — `server/src/modules/scheduler/scheduler.service.ts` — prompt 03 — **static test failing** (see §3.6-A).
- **S6-01** — `safeFetch` for every user-URL fetch — `server/src/shared/net/safe-fetch.ts:143` + `server/src/modules/alerting/alert.service.ts:42` — prompt 06 — proven by `server/src/shared/net/safe-fetch.test.ts` + `shared/middleware/command-execution-meta.test.ts`.
- **S1-02** — Redis-backed rate limiter store in prod — `server/src/shared/middleware/rate-limit*.ts` — prompt 01.
- **S3-03** — atomic `findOneAndUpdate({owner, projects:{$lt:cap}}, {$inc:{projects:1}})` guard — `server/src/modules/billing/usage-counter.model.ts` — prompt 03 — **static test failing** (see §3.6-A).
- **S7-03** — HMAC-derive self-backup password — `server/src/boot/recovery.ts:90,106` — prompt 07 — proven by `server/src/boot/recovery.test.ts`.
- **S8-01** — FIXED-BY-DESIGN — `server/src/modules/legal/legal.service.ts:28-31` — prompt 08.
- **S8-02** — closed by S7-01 pino redaction — prompt 07.
- **S1-01** — `verified` gate at mount — `server/src/app.ts` — prompt 01 — proven by `security-meta.test.ts`.
- **S1-03** — `padAuthTiming` — `server/src/modules/auth/auth.service.ts` — prompt 01.
- **S2-01** — 404 existence-cloak on all owner-scoped loaders — prompt 02 — proven by `shared/middleware/idor-meta.test.ts`.
- **S2-02** — `stampProject` owner-scoped — `server/src/modules/agents/agent-jobs.service.ts` — prompt 02.
- **S2-03** — owner-scoped `AgentJob.find` — `server/src/modules/agents/agents.controller.ts` — prompt 02.
- **S7-04** — stack removed from 500 response — `server/src/shared/middleware/error-handler.ts` — prompt 07 — proven by `shared/middleware/coverage.test.ts`.
- **S8-03** — socket owner compared to authed user id — `server/src/modules/scheduler/scheduler.logstream.ts:60-65` — prompt 08.

---

## §3.3 — Tests added (before/after)

Per-surface. Every test written by prompts 01–08; prompt 09 only re-runs the suite.

| test | file | before → after | covers |
|---|---|---|---|
| composite-token verify invariants | `server/src/shared/middleware/agent-machine-meta.test.ts` | FAILED → PASSES | surface 5 |
| daemon `DOCKSTASH_URL` required + no log lines + redaction parity | `agent/src/security-meta.test.ts` | FAILED → PASSES | surface 5 |
| `no bare fetch in alerting; every user-URL through safeFetch`; compose socket mount only into proxy; no `shell:true`; no `child_process.exec` in backups/agent; no `StrictHostKeyChecking=no` | `server/src/shared/middleware/command-execution-meta.test.ts` | FAILED → PASSES | surface 6 |
| scheme allowlist + IPv4/IPv6 block CIDRs + DNS + redirect re-validation + too-many-redirects cap | `server/src/shared/net/safe-fetch.test.ts` | FAILED → PASSES | surface 6 |
| pino redacts direct+deep secret paths incl. `req.body.password`/`repoPassword`/`privateKey`; `req.headers.authorization`/`cookie` | `server/src/config/logger-redaction.test.ts` | FAILED → PASSES | surface 7, S8-02 |
| `password: env.MASTER_ENCRYPTION_KEY` banned; `errorHandler` never emits stack; secret allowlist pinned | `server/src/shared/middleware/secrets-meta.test.ts` | FAILED → PASSES | surface 7 |
| `deriveSelfBackupPassword` never-equal, deterministic, per-master distinct | `server/src/boot/recovery.test.ts` | FAILED → PASSES | S7-03 |
| errorHandler never leaks stack, 500 body is `{error:{message}}` in every env | `server/src/shared/middleware/coverage.test.ts` | FAILED → PASSES | S7-04 |
| no `req.query`/`body`/`params` spread into Mongoose filter; `/api/superadmin` gated at mount only; error handler emits i18n keys only | `server/src/shared/middleware/injection-and-output-meta.test.ts` | FAILED → PASSES | surface 8 |
| every gated controller has API-layer assert; reserve precedes create; PATCH scheduler re-runs tier gate | `server/src/shared/middleware/entitlement-meta.test.ts` | FAILED → **FAILING** (28 tests, incl. S3-01/S3-02/S3-03 regressions) | surface 3 — see §3.6-A |
| cap-boundary concurrency proof | `server/src/modules/billing/entitlements-cap.test.ts` | FAILED → **FAILING** (typecheck: imports `reserveProjectSlot`/`releaseProjectSlot`/`adjustProjectCounter`/`reconcileProjectCounter` not exported) | S3-01/S3-03 — see §3.6-A |
| Passport JWT `algorithms: ['HS256']` pin; no second `jwt.verify`; `verified` mount at both health routers | `server/src/shared/middleware/security-meta.test.ts` | FAILED → PASSES | surface 1 |
| cross-account matrix (backups/scheduler/agents/health) | `server/src/shared/middleware/idor-meta.test.ts` | FAILED → PASSES | surface 2 |
| webhook verify-before-parse, timingSafeEqual, replay window, insert-first idempotency | `server/src/modules/billing/webhook/webhook-verify-meta.test.ts`, `webhook-dispatch.test.ts` | FAILED → PASSES | surface 4 |

---

## §3.4 — Rules + meta-tests added

Rule files (`.claude/rules/`) authored by this batch:

- `.claude/rules/passport-jwt-algorithms-pin.md` — surface 1
- `.claude/rules/owner-scoped-queries.md` — surface 2
- `.claude/rules/entitlement-cap-ordering.md` — surface 3
- `.claude/rules/webhook-verify-before-parse.md` — surface 4
- `.claude/rules/agent-machine-surface.md` — surface 5
- `.claude/rules/argv-only-spawn-and-ssrf.md` — surface 6
- `.claude/rules/secrets-and-rotation.md` — surface 7
- `.claude/rules/no-query-injection-and-i18n-errors.md` — surface 8

Meta-tests / ESLint `no-restricted-syntax` guards:

- `server/src/shared/middleware/security-meta.test.ts` — surface 1 (HS256 pin, no second verify, verified-mount)
- `server/src/shared/middleware/idor-meta.test.ts` — surface 2 (owner-scoped `findOne` shape)
- `server/src/shared/middleware/entitlement-meta.test.ts` — surface 3 (**currently failing** — see §3.6-A)
- `server/src/modules/billing/webhook/webhook-verify-meta.test.ts` — surface 4
- `server/src/shared/middleware/agent-machine-meta.test.ts` + `agent/src/security-meta.test.ts` — surface 5 (cross-copy parity)
- `server/src/shared/middleware/command-execution-meta.test.ts` + `server/src/shared/net/safe-fetch.test.ts` — surface 6
- `server/src/shared/middleware/secrets-meta.test.ts` + `secrets-response.test.ts` + `server/src/config/logger-redaction.test.ts` — surface 7
- `server/src/shared/middleware/injection-and-output-meta.test.ts` — surface 8
- `server/eslint.config.js` + `agent/eslint.config.js` — `no-restricted-syntax` on `spawn(..., { shell: true })`; `no-restricted-imports` on `exec`/`execSync`/`execFile` in `modules/backups/**` + `agent/src/**`; `no-console` in `modules/superadmin/**`.

---

## §3.5 — Full suite + coverage + audit result (verbatim)

Every command run in Docker (`node:20-bookworm`) per `.claude/rules/docker-only-commands.md`.

### Server (`server/`)

| Step | Result |
|---|---|
| `npm run typecheck` | **FAIL** — 8 TS errors (S3-01/S3-03 regressions: `entitlements-cap.test.ts` imports `adjustProjectCounter`, `reconcileProjectCounter`, `releaseProjectSlot`, `reserveProjectSlot` — none exported by `entitlements.service.ts`; `oauth.test.ts` `HttpStub` index-signature widening; `oauth.test.ts:690` arity mismatch) |
| `npm run lint` | **FAIL** — 1 error (`src/modules/seo/seo.routes.ts:14` unused `PLATFORM_GUIDE_SLUGS`) + 9 warnings |
| `npx vitest run --coverage` | **FAIL** — `Test Files 5 failed / 86 passed (91)`; `Tests 28 failed / 1430 passed / 8 skipped (1466)`. Failures include `ci-gates.test.ts` (client vitest 100% threshold assertion), `entitlement-meta.test.ts` (S3-01/S3-02/S3-03 regressions), `seo.parity.test.ts` (reads `/client/src/features/marketing/routes.tsx` — path unavailable in server-only mount). Coverage summary suppressed by test failures. |
| `npm audit --audit-level=high` | **FAIL** — 6 vulnerabilities (3 moderate, 1 high, 2 critical). Advisory chain: vite → vite-node / @vitest/mocker → vitest → @vitest/coverage-v8 (dev-dep tree). |

### Client (`client/`)

| Step | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** |
| `npx vitest run --coverage` | **FAIL on threshold** — `Test Files 132 passed (132)`; `Tests 1275 passed (1275)`. Coverage: 100% stmt / **99.93% branches** / 100% funcs / 100% lines — **below the 100/100/100/100 v8 gate** (`AppSidebar.tsx:105` branch 93.75%; `Header.tsx:81` branch 90%). |
| `npm audit --audit-level=high` | **FAIL** — same vite/vitest advisory chain (6 vulns, 3 moderate / 1 high / 2 critical). |

### Agent (`agent/`)

| Step | Result |
|---|---|
| `npx vitest run --coverage` | **PASS** — `Test Files 17 passed (17)`; `Tests 292 passed (292)`; **100% / 100% / 100% / 100%** on every touched file (adapters, api-client, backup, config, discovery, docker-client, executor, health, logging, main, paths, poller, restic-runner, restore-plan, restore, types). |
| `npm audit --audit-level=high` | **FAIL** — same vite/vitest chain (6 vulns, 3 moderate / 1 high / 2 critical). |

---

## §3.6 — Open items

### §3.6-A — Surface 3 regressions (blocker)

Prompt 03 shipped the API-layer assert/reserve controls (annotated as
FIXED in `findings.md`), but the preventive tests it ships fail because
the referenced service exports don't exist. The controls-in-code AND the
guards MUST both live to close the surface.

- `server/src/modules/billing/entitlements-cap.test.ts` imports
  `reserveProjectSlot`, `releaseProjectSlot`, `adjustProjectCounter`,
  `reconcileProjectCounter` — none exported from
  `server/src/modules/billing/entitlements.service.ts`
  (verified by `grep -n "^export " entitlements.service.ts` — none of
  those names present). Typecheck fails; the concurrency proof cannot run.
- `server/src/shared/middleware/entitlement-meta.test.ts` asserts:
  - `backups/backups.controller.ts::create` body contains
    `reserveProjectSlot` — **regex-miss in current source**;
  - `reserveProjectSlot` precedes `createProject(` in that body —
    **both indices -1**;
  - `scheduler/scheduler.service.ts::updateSchedule` body contains
    `assertScheduleAllowed` — **regex-miss in current source**.

**Route back to prompt 03.** The fix: either export the missing helpers
from `entitlements.service.ts` (add `reserveProjectSlot`,
`releaseProjectSlot`, `adjustProjectCounter`, `reconcileProjectCounter`
and wire them into `backups.controller::create` per the meta-test
expected shape), OR update the tests to reflect the actual chosen shape
if a different atomic guard was used. Silencing the tests is a weakened
gate (Phase 2.1) and itself a finding.

**Findings this re-opens:** S3-01, S3-02, S3-03.

### §3.6-B — Server lint blocker

`server/src/modules/seo/seo.routes.ts:14` imports
`PLATFORM_GUIDE_SLUGS` and never uses it. One-line delete of the import
closes it; ESLint would otherwise be forced to allow unused vars, which
is a weakened gate. Not a security finding but blocks CI green.

### §3.6-C — Server oauth test type errors

`server/src/modules/auth/oauth/oauth.test.ts:90/105/690` — pre-existing
`HttpStub` index-signature widening + arity mismatch on line 690. Not
introduced by the security batch, but blocks typecheck alongside the
§3.6-A regression. Route to the auth-tests owner.

### §3.6-D — Server unit failures unrelated to security

- `src/modules/seo/seo.parity.test.ts` — reads
  `/client/src/features/marketing/routes.tsx`; the server-only Docker
  mount doesn't include `client/`. Test infrastructure gap, not a
  security regression. Route to the SEO / test-tooling owner.
- `src/ci-gates.test.ts` — the client 100%-threshold assertion fails
  because the client actually shipped at 99.93% branches (see §3.6-E).

### §3.6-E — Client branch coverage below 100

`Coverage for branches (99.93%) does not meet global threshold (100%)`.
Uncovered:

- `client/src/shared/components/AppSidebar.tsx:105` — 93.75% branches
- `client/src/shared/components/Header.tsx:81` — 90% branches

Not a security finding. Route to the client-UI owner to add the missing
branch tests or annotate the uncovered branches with justified `/* c8
ignore next */` (do NOT lower the threshold).

### §3.6-F — npm audit high/critical (all packages)

6 advisories per package (3 moderate, 1 high, 2 critical) in the
vite/vitest dev-dependency chain (`vite`, `vite-node`,
`@vitest/mocker`, `vitest`, `@vitest/coverage-v8`). Dev-only exposure
but **fails the `--audit-level=high` gate** in `server/`, `client/`,
`agent/`. Route to `dependency-manager`: bump vitest+vite to a version
whose advisory tree resolves, or file `npm audit fix --force` under
per-turn approval (breaking-change risk). Do NOT downgrade
`--audit-level=high`.

### Deliberately not touched

- Surface 4 (Polar webhook) has zero findings; prompt 04's re-verify is
  the deliverable. No code change.
- Surface 5 (fleet-agent machine surface) has zero findings; prompt 05's
  cross-copy parity meta-tests are the deliverable. No code change.
- S8-01 (legal export ships ciphertext bundle) — FIXED-BY-DESIGN. Master
  key never leaves env; envelope alone is inert. No code change.

---

## §3.7 — Sign-off

> **OPEN items remain — 6 blockers across §3.6-A / §3.6-B / §3.6-C /
> §3.6-D / §3.6-E / §3.6-F. Surface 3 (S3-01, S3-02, S3-03) is
> functionally regressed because the atomic-reserve helpers referenced by
> the preventive tests are not exported; server typecheck and lint fail;
> server unit suite reports 28 failing tests; client branch coverage is
> 99.93% (below the 100% v8 gate); `npm audit --audit-level=high`
> reports 6 vulnerabilities (1 high, 2 critical) across every package.**

The Critical S7-01/S7-02 fixes (pino redaction), the High S6-01 fix
(SSRF `safeFetch`), the surface-1/2/5/6/7/8 preventive meta-tests, the
argv-only-spawn + SSH-host-key + Docker-socket-proxy invariants, and
the 8 rule files under `.claude/rules/` are all **VERIFIED in code**
and **PASSING in the suite where they're reachable**. Surface 3 (High
severity, three findings) needs one more prompt 03 iteration to land
the missing exports so its preventive gate turns green.

Agent package is fully clean (100/100/100/100, 292/292 pass) except for
the dev-dep audit chain shared with server+client.

---

## Appendix — verify commands run (Docker, no host binaries)

```
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm run typecheck
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm run lint
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npx vitest run --coverage
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm audit --audit-level=high
docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npm run typecheck
docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npm run lint
docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npx vitest run --coverage
docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npm audit --audit-level=high
docker run --rm -v "$PWD/agent":/app  -w /app node:20-bookworm npx vitest run --coverage
docker run --rm -v "$PWD/agent":/app  -w /app node:20-bookworm npm audit --audit-level=high
```

Phase 2 spot-checks:

- Coverage thresholds in `server/vitest.config.ts` / `client/vitest.config.ts`
  unchanged at 100/100/100/100 (assertion in `ci-gates.test.ts`).
- `no-restricted-syntax` rules from prompts 01/06/07/08 present and active
  in `server/eslint.config.js` and `agent/eslint.config.js`.
- `docker-compose.yml` mounts `/var/run/docker.sock` only into
  `docker-socket-proxy` (line 73-74); api uses
  `DOCKER_HOST=tcp://docker-socket-proxy:2375` (line 142) — confirmed by
  `command-execution-meta.test.ts`.
- No `child_process.spawn(..., { shell: true })` in `modules/backups/**`
  or `agent/src/**`.
- No `StrictHostKeyChecking=(no|accept-new)` anywhere outside test
  fixtures.

Phase 4 (branch / commit) NOT executed — operator did not request commit
or PR.
