# STEP 1 — Recon: Findings Table Across All 8 Surfaces — Build Prompt

> **Read-only recon FIRST.** This prompt produces the **findings table** that
> drives prompts `01`–`08`. Run `security-auditor` (Read/Grep/Glob only — no
> Edit, no Bash mutations) so the findings are unbiased by partial fixes.
> Every surface prompt depends on this table's ranking. Skipping it means
> fixing blind.

---

## Agent

`security-auditor` (`.claude/agents/quality/security-auditor.md`) — read-only
recon. It already knows the hotspots: Polar webhook raw-body mount order,
agent composite-token verify, AES-256-GCM secret envelopes, restic/ssh
argv-only spawn, docker-socket-proxy least privilege, entitlement caps before
create. **Do NOT use an agent with Edit here** — the deliverable is a report,
not a patch.

## Mission

Produce the **STEP 1 findings table** from `prompts/SECURITY.md` §
"Deliverables — do ALL of these, in order", covering all eight threat surfaces
defined in § "Threat surfaces specific to this codebase — audit EACH
explicitly". Each finding carries: id, title, `file:line`, threat surface
(1–8), concrete failure scenario (specific inputs/state → wrong
output/access/spend), severity (Critical / High / Medium / Low), and
confidence.

Rank Critical/High first. Prefer **fewer, confirmed** findings over a long
speculative list — read each code path end-to-end before asserting a bug. Mark
anything unproven as **PLAUSIBLE**.

## Operating Constraints

| Rule | Detail |
|---|---|
| Read-only | No Edit, no Bash mutations. `security-auditor` only (Read/Grep/Glob). If a fix is "obvious", note it but DO NOT apply — that is prompts `01`–`08`. |
| Source of truth | `prompts/SECURITY.md` is the scope. Read it before grepping. The eight surfaces and their exact file paths are the audit checklist. |
| Honor live rules | Docker-only commands (`docker-only-commands.md`); if you need to run anything (e.g. `git log` for history), use `docker run --rm -v "$PWD":/app -w /app node:20-bookworm …`. Read-only greps need no container. |
| No invented scope | Do NOT invent files or surfaces. If a path in `SECURITY.md` doesn't exist, flag it as a finding ("documented control absent") rather than skipping. |
| End-to-end read | Before asserting a bug, read the code path from route mount → middleware → controller → service → model → queue/spawn. A loose `===` on a signature is only a finding if verify-before-parse is intact; a missing owner scope is only a finding if there's no compensating controller check. |
| Mark unproven | PLAUSIBLE tag for anything not end-to-end-confirmed. Do not over-claim severity to look thorough. |
| No fixes | STEP 2 (adversarial inputs), STEP 3 (fix), STEP 4 (test), STEP 5 (prevent) belong to `01`–`08`. This prompt ends at STEP 1. |

## Phases

### Phase 0 — Load the scope
- 0.1 Read `prompts/SECURITY.md` end-to-end. Internalize the eight surfaces,
  the file paths each names, and the deliverable rubric.
- 0.2 Read the governance rules `SECURITY.md` references (`.claude/rules/
  docker-only-commands.md`, `environment-variables.md`, `site-url-env-
  pattern.md`, `git-destructive-commands.md`, `mern-feature-modules.md`,
  `mern-mongoose-typed-schemas.md`).
- 0.3 Read the operator docs that define intended behavior: `docs/security-
  model.en.md`, `docs/ci-gates.en.md`, `docs/fleet-agents.en.md`,
  `docs/polar-billing-and-webhooks.en.md`, `docs/plans-and-limits.en.md`,
  `docs/data-rights.en.md`, `server/src/shared/i18n/README.md`.

### Phase 1 — Surface #1 AUTHENTICATION & SESSION
- 1.1 In `server/src/app.ts` confirm the Polar webhook raw-body route
  (`app.post('/api/billing/webhook', createWebhookRateLimiter(),
  express.raw(...), webhookHandler)`) is mounted **BEFORE**
  `app.use(express.json(...))`. Verify the **current** line numbers — do not
  assume. A handler after `express.json()` gets a consumed stream → HMAC
  verifies against an empty buffer.
- 1.2 Identity is read **only** via Passport `'jwt'` in
  `shared/middleware/require-auth.ts`. The strategy
  (`modules/auth/passport.strategies.ts`) extracts `Authorization: JWT <token>`
  and MUST pin `algorithms: ['HS256']`. Flag any hand-parsed token, any second
  `jsonwebtoken.verify` with a loose `algorithms`, any identity read off
  `req.cookies`.
- 1.3 Passwords: bcryptjs, generic "invalid email or password". Email-verify
  and password-reset tokens are CSPRNG + SHA-256-hashed at rest (raw only
  emailed), bounded TTL; forgot-password/resend must be non-enumerating. Flag
  plaintext token storage or an enumerable response.
- 1.4 Cookie/CORS/CSRF: CORS is `credentials:true` scoped to `env.CLIENT_URL`
  **only** — flag wildcard or reflected origin with credentials. CSRF
  (`shared/middleware/csrf.ts`) is double-submit and EXEMPTS requests bearing
  an `Authorization` header. Confirm the CSRF cookie's `secure` flag in
  production, and whether `requireCsrf` is actually mounted on every
  cookie-authenticated mutating surface — a cookie surface that skips it is a
  finding.
- 1.5 Rate limiters (`shared/middleware/rate-limit.ts`):
  `createAuthRateLimiter` on `/api/auth/*` credential mutations,
  `createWebhookRateLimiter` pre-HMAC, `createContactRateLimiter` on the
  contact form, `createAgentRateLimiter` on `/api/agent`. The read-only OAuth
  capability probe (`oauthPublicRouter`) is intentionally mounted BEFORE the
  auth limiter — confirm credential POSTs (sign-in/up/reset) are NOT similarly
  exempt. Note the limiter store is in-memory per-process; flag if a
  multi-instance deployment could bypass it AND that is load-bearing.
- 1.6 Superadmin step-up: login from an untrusted device requires email OTP
  (`login-otp.service`, `trusted-device.model`) and issues NO JWT until the
  challenge verifies. Confirm the OTP gate is in the **live login path**, not
  merely defined.

### Phase 2 — Surface #2 CROSS-ACCOUNT / IDOR ISOLATION
- 2.1 EVERY resource load MUST be owner-scoped **at query time**:
  `Model.findOne({ _id, owner: req.user.id })` (never `findById(id)` + a
  separate ownership `if`). Grep for `findById(` and `findOne({ _id` across
  `server/src/modules/**` and flag every hit not joined to the owner.
- 2.2 Per module, audit owner scoping: `backups` (projects/snapshots),
  `scheduler`, `recovery`, `agents`, `alerting`, `audit` (log), `settings`,
  `billing`, `legal`.
- 2.3 Nested ownership: a snapshot/schedule/restore-drill/agent-job belongs to
  a project/agent that belongs to a user. An attacker can pass ANY id in the
  URL — confirm the parent is owner-scoped first AND the child JOINs back to
  `owner`, not just the parent id.
- 2.4 Existence-leak policy: `requireRole` (`shared/middleware/require-
  role.ts`) returns 403 for an authenticated lower-privilege user (it does
  NOT 404-cloak) — do NOT "fix" that to 404 blindly. For OWNER-scoped
  resources prefer 404 on a non-owned existing id so existence isn't leaked;
  flag inconsistency but match the existing per-module convention rather than
  inventing one.
- 2.5 Role gates: only `/api/superadmin` is gated by
  `requireRole(ROLE_SUPERADMIN)` in `app.ts`. Confirm the middleware is
  APPLIED in the chain, not just exported, and that `ROLE_ADMIN` (rank 4) has
  no unintended write path if any admin surface exists.

### Phase 3 — Surface #3 PLAN CAPS / ENTITLEMENT BYPASS
- 3.1 Read `modules/billing/entitlements.service.ts`: `assertProjectCap`,
  `assertScheduleAllowed`, `assertRestoreDrillAllowed`, `assertAlertsAllowed`,
  `assertMultiVpsAllowed`, `assertMirrorAllowed`, `assertPitrAllowed`,
  `clampRetentionDays`/`clampRetentionPolicy`, `classifyCron`.
- 3.2 Every gated create/enable MUST call the matching assert at the **API
  layer BEFORE** the domain record is reserved or a queue job is enqueued.
  Required order: parse (zod) → own (load owner-scoped) → assertCapacity →
  reserve → enqueue. Flag caps checked only in a BullMQ worker, only in the
  resolver, or skipped on a create path.
- 3.3 Concurrency/TOCTOU: two simultaneous "create project" requests at
  `remaining == 1` must not both pass. If the cap is a read-then-write count,
  prove whether a unique index / atomic guard closes the window; flag if not.
- 3.4 Tier definitions come from `plans.ts` + the pricing-tier model — flag
  ad-hoc numeric limits hardcoded in a feature module instead of resolved
  from the tier.
- 3.5 Money is server-derived: subscription/order amounts come from the
  provider webhook + tier catalog, never a client-supplied amount trusted
  without re-derivation.

### Phase 4 — Surface #4 WEBHOOK & PAYMENT INTEGRITY (Polar)
- 4.1 Standard-Webhooks HMAC verified on the **raw body BEFORE `JSON.parse`**
  (`modules/billing/webhook/verify` + `ingest`). Flag any parse-before-verify,
  any `===`/`!=` string compare on the signature (must be `timingSafeEqual`),
  any missing/optional check.
- 4.2 `POLAR_WEBHOOK_SECRET` is **optional** in env — confirm that when UNSET
  the webhook **FAILS CLOSED** (rejects) rather than skipping verification. A
  skip-on-missing-secret is a **Critical** finding.
- 4.3 Idempotency: `webhook-event.model` records processed events; a replayed
  event must not double-grant a subscription or double-apply a lifecycle
  transition. Refunds/cancellations post linked state, never a silent hard
  delete of history.
- 4.4 The webhook route sits behind `createWebhookRateLimiter` BEFORE
  `express.raw`; confirm a flood of forged signatures can't exhaust CPU or DB
  before rejection, and the limiter never consumes the body used for HMAC.

### Phase 5 — Surface #5 FLEET-AGENT MACHINE SURFACE (`/api/agent`)
- 5.1 The `/api/agent` router (`modules/agents/agent-api.*`) authenticates
  daemons via `require-agent-auth.ts`: composite token
  `dsa_<24-hex agentId>.<48-hex secret>`, secret hashed with `hashApiSecret`
  (HMAC-SHA256 keyed by master key), verified with `timingSafeEqual`,
  unknown-id path still pays the HMAC cost against a dummy record (timing
  flatten), always ONE generic 401. Confirm none of these properties has
  regressed and no path returns a distinguishing error.
- 5.2 Per-agent scope: EVERY `/api/agent` handler must scope to
  `req.agent.id`/`req.agent.owner`. An agent claiming a job, reporting a
  result, or fetching config MUST only touch jobs/records for ITS OWN agent id
  — never another agent's or another owner's. Flag any agent-job lookup by
  **job id alone** without the agent-id join. This is the highest-value IDOR
  surface in the product.
- 5.3 Token lifecycle: issued once, never returned again; rotation
  (`rotateAgentKey`) invalidates the old token immediately. Flag any route
  that echoes an existing secret, or a rotation that leaves the old hash valid.
- 5.4 The agent daemon (`agent/src`): `api-client` must pin `SERVER_URL` from
  config (no hardcoded host), must not log its Bearer token, and
  `executor`/`restic-runner`/`docker-client` must not shell-inject
  server-supplied job parameters (see surface #6).

### Phase 6 — Surface #6 COMMAND EXECUTION / SSRF / INPUT VALIDATION
- 6.1 `restic-runner` (`modules/backups/backups.restic-runner.ts`) MUST spawn
  **argv-only** via `child_process.spawn` (NEVER a shell string, never
  `exec`/`sh -c`), pass the repo password via **env** not argv, and force safe
  SSH options for SFTP repos. Audit every `spawn`/`exec` across backups
  (`restic-runner`, `ssh-transport`, `docker-client`, `mirror.service`,
  `restore.service`, `pitr`, `scan`) AND `agent/src` (`executor`,
  `restic-runner`, `docker-client`): any user/job-supplied value (project
  name, path, repo URL, container id, cron) concatenated into a shell string
  is a command-injection finding.
- 6.2 SSH host-key pinning: `ssh-transport` MUST verify the pinned host key
  (`STORAGE_SSH_HOST_KEY_FINGERPRINT`), never fall back to
  `StrictHostKeyChecking=no` / auto-accept.
- 6.3 Docker socket: the api reaches Docker **only** via
  `DOCKER_HOST=tcp://docker-socket-proxy:2375` with the endpoint allowlist
  (`CONTAINERS`/`EXEC`/`INFO`); it must NEVER bind-mount
  `/var/run/docker.sock`. Flag any direct socket mount, any dockerode/
  raw-socket path, any exec into a container the requesting user does not own.
- 6.4 SSRF: any server-side fetch taking a user-supplied host/URL must enforce
  a scheme allowlist AND reject internal/loopback/link-local/metadata targets
  (`169.254.169.254`, `127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`,
  `::1`, `fc00::/7`), re-validating on redirect. The known live surface is the
  alert webhook (`modules/alerting/alert.service.ts` `defaultWebhookPoster`
  POSTs to `project.alertWebhookUrl`, validated only as an http(s) URL in the
  alerts schema — no private-IP block). Also check mirror/remote destinations.
- 6.5 zod-validate every request body (`*.schema.ts`).

### Phase 7 — Surface #7 SECRETS & DATA-AT-REST
- 7.1 Restic repo passwords, SSH keys, and any at-rest secret use the
  AES-256-GCM envelope in `shared/crypto` (`encryptSecret`/`decryptSecret`,
  keyed by `MASTER_ENCRYPTION_KEY`; rotation via `keyRegistry.ts` +
  `rotate.ts::rotateStore`; re-encrypt is idempotent when `keyVersion ==
  target`). Flag plaintext secret storage, a hardcoded key, an IV reused
  across encryptions, or a secret returned by any route. The plaintext restic
  password is shown once and never persisted/logged.
- 7.2 pino redaction (`config/logger.ts`) must cover `Authorization` headers,
  cookies, JWTs, passwords, `SUPERADMIN_PASSWORD`, `POLAR_*` creds, agent
  Bearer tokens, `MASTER_ENCRYPTION_KEY`, SSH keys. No secret in logs, thrown
  error messages, or recorded fixtures.
- 7.3 `SUPERADMIN_EMAIL`/`PASSWORD` seeder (`modules/superadmin/
  superadmin.seed.ts`) must be idempotent, never overwrite an existing
  account, and redact the password from every log line.
- 7.4 No `.env` outside repo root (`environment-variables.md`); no hardcoded
  URLs (`site-url-env-pattern.md`).

### Phase 8 — Surface #8 INJECTION & OUTPUT
- 8.1 No Mongoose query built from unsanitized `req.body`/`req.query` enabling
  operator injection (`{ $gt: '' }`, `$where`, `$regex` DoS). Cast/validate
  every id (`isValidObjectId`); never spread `req.query` into a filter.
- 8.2 Role/authz output: superadmin endpoints must not leak other tenants'
  data; the superadmin console is gated by `requireRole(ROLE_SUPERADMIN)` —
  confirm every sub-route inherits it.
- 8.3 Data-rights export/delete (`legal` module) is owner-scoped, cannot
  exfiltrate another tenant, and honors the deletion grace window before a
  hard purge (`docs/data-rights.en.md`).
- 8.4 Error messages reaching the client are i18n keys, not raw exception text
  (no stack/secret leakage through `error-handler`).

### Phase 9 — Produce the findings table
- 9.1 Emit ONE table with columns: **id | title | file:line | surface (1–8) |
  failure scenario | severity | confidence**. Sort Critical → High → Medium →
  Low. Group by surface within each severity band.
- 9.2 For each finding, name the **specific inputs/state** that trigger it
  (e.g. "two concurrent `POST /api/projects` at remaining==1 with no unique
  index on (owner, name)") and the **wrong outcome** (e.g. "both 201, cap now
  N+1"). Vague "could be exploited" rows are rejected.
- 9.3 Cross-reference each finding to the surface prompt that will fix it
  (`01`–`08`). This is the routing table for the rest of the batch.
- 9.4 Write the table to `prompts/dockstash-security/findings.md` (append-only
  contract: prompts `01`–`08` will annotate their rows with `— FIXED at
  file:line` as they close them; `09` re-reads this file to produce the final
  report). Do not edit the findings retroactively — append status annotations.

## Tests

No tests are written in this prompt — it is read-only recon. The deliverable
is `findings.md`. The adversarial-input tests (STEP 2) and fix tests (STEP 4)
are written by `01`–`08`.

## i18n

No i18n changes in this prompt. If a finding reveals a raw-exception leak
(surface #8.4), note the missing locales for the fixing prompt (`08`) — do not
add keys here.

## Documentation

- `prompts/dockstash-security/findings.md` — the findings table (the
  deliverable). Format: the table from Phase 9, plus a per-surface subsection
  with the code-path trace that established each finding (so the fixing agent
  doesn't have to re-read the whole module).
- Do NOT modify `docs/*`, `CLAUDE.md`, or `.env.example` in this prompt —
  those belong to the fixing prompts and `09`.

## Agents & Skills

- **Agent:** `security-auditor` (read-only — the only agent in this prompt).
- **Skills:** `/security-review` in `full` mode (read-only semantic pass) to
  cross-check the manual grep findings. Do NOT run `branch`/`targeted` — the
  scope is the whole repo's security surfaces.

## Idempotency Contract

Re-running MUST NOT: append a duplicate findings table (detect an existing
`findings.md` and reconcile in place — re-verify each row, demote/promote
severity only with an explicit reason annotation, never silently delete a
finding), or downgrade a confirmed finding to PLAUSIBLE without an
end-to-end trace showing the original read was wrong. A re-run that finds
nothing new is the success state — it appends a single "re-verified YYYY-MM-DD
— no new findings" line at the top of `findings.md`.
