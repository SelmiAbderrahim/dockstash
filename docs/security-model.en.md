# Security model & threat model

This document describes the hardening pass added in the security-hardening pass and
the blast radius of the Dockstash orchestrator.

## App-layer hardening

| Concern | Control | Where |
|---------|---------|-------|
| Common HTTP headers | `helmet()` (defaults, `crossOriginResourcePolicy: same-site`, `referrerPolicy: no-referrer`) | `shared/middleware/security-headers.ts` |
| Credential-stuffing on `/api/auth/*` | `express-rate-limit`, default 10 req / 15 min per IP (`RATE_LIMIT_AUTH_*`); Redis-backed store when `REDIS_URL` set so multi-instance deployments share one bucket (S1-02) — falls back to in-memory otherwise | `shared/middleware/rate-limit.ts` + `shared/middleware/rate-limit-redis-store.ts` |
| Passport JWT algorithm | Strategy pins `algorithms: ['HS256']` — rejects `alg:none` and RS256-confusion. Only one verify path (passport-jwt); no hand-parsed tokens; enforced by the static meta-test at `shared/middleware/security-meta.test.ts` and the `passport-jwt-algorithms-pin` rule | `modules/auth/passport.strategies.ts` |
| Non-enumerating auth surfaces | Same generic response for known / unknown email on `/api/auth/{forgot-password,resend-verification}`; both hit and miss branches pad to `authTimingPadMs` (default 400ms) so response-latency samples cannot cluster into "known" vs "unknown" populations (S1-03) | `modules/auth/auth.service.ts` (`padAuthTiming`) |
| Unverified accounts blocked from product surfaces | Every authenticated router — including `/api/health/{projects,overview,alerts}` (S1-01) — mounted behind `[requireAuth, requireVerified]`; unauthenticated liveness `/api/health` + `/api/metrics` stay public | `app.ts` (the shared `verified` array) |
| CORS | Locked to exactly `env.CLIENT_URL` with `credentials: true` — no wildcard, no reflected origin | `app.ts` |
| CSRF (cookie-borne auth surfaces) | Double-submit cookie + header (`x-csrf-token`); safe methods pass; bearer-token requests exempt (documented below); mutating cookie surfaces reject on missing/mismatched token | `shared/middleware/csrf.ts` |
| Body validation | Every mutating route parses its body via a per-module zod schema. New routes must add one under `<module>.schema.ts` before wiring |

### Bearer-token CSRF exemption

The Passport JWT strategy extracts credentials from
`Authorization: JWT <token>`. When the request carries an `Authorization`
header, CSRF is a non-issue: the browser never attaches that header
cross-origin without explicit code. `requireCsrf` therefore skips those
requests. A future cookie-authenticated surface MUST call
`GET /api/security/csrf-token` first and echo the token in the
`x-csrf-token` header on the mutating request.

## Transport / key trust

- **SSH host-key pinning** — every `SshTransport` implementation MUST expose
  `verifyHostKey`. `PinnedSshTransport`
  (`modules/backups/backups.ssh-transport.ts`) pins the storage-VPS host key
  in `sha256:BASE64` form via `STORAGE_SSH_HOST_KEY_FINGERPRINT` and throws
  on mismatch. No `StrictHostKeyChecking=no`, no auto-accept. A rotated host
  key surfaces as a loud backup failure.
- **Restic-password escrow** — the plaintext restic password is shown once at
  storage setup (prompt 10 UI). The server stores only its AES-256-GCM
  ciphertext (`repoPasswordEnc`, prompt 03). The plaintext is never persisted,
  logged, or returned by any route.
- **Master-key rotation** — `shared/crypto/rotate.ts::rotateStore` iterates
  every ciphertext under a store, decrypts with the stored `keyVersion`, and
  re-encrypts under the new target. Failure stops rotation and reports
  `failedAt`; already-swapped records are idempotent because
  `reEncryptSecret` short-circuits when `record.keyVersion === target`. See
  `server/src/shared/crypto/README.md` for the operator runbook.

## Docker socket least-privilege

- The `api` container reaches Docker exclusively via `DOCKER_HOST=tcp://docker-socket-proxy:2375`. It never bind-mounts `/var/run/docker.sock`.
- The `docker-socket-proxy` service is the only container with the socket, mounted `:ro`. Endpoints are limited to `CONTAINERS`/`EXEC`/`INFO`; everything else is denied.
- The `api` and `docker-socket-proxy` services carry `cap_drop: [ALL]` and `security_opt: [no-new-privileges:true]`.

## Fleet-agent machine surface (`/api/agent`)

- **Composite-token verify.** `require-agent-auth.ts` parses `dsa_<24-hex
  agentId>.<48-hex secret>` with an anchored regex, `findById`s the
  agent, and calls `verifyApiSecret` (HMAC-SHA256 keyed by
  `MASTER_ENCRYPTION_KEY`, compared with `crypto.timingSafeEqual`). The
  unknown-agentId branch still pays the HMAC cost against a dummy record
  so the timing is flat. Every failure branch returns ONE generic 401
  (`agents.error.unauthorized`) — no distinguishing message.
- **Per-agent scope.** Every `/api/agent` handler reads `req.agent` and
  scopes DB queries by `agent: principal.id`. Bare
  `AgentJob.findById(req.params.jobId)` is banned; the meta-test
  `server/src/shared/middleware/agent-machine-meta.test.ts` fails on
  regression.
- **Token lifecycle.** Registration and rotation return the composite
  token exactly ONCE — the server keeps only the HMAC. `rotateAgentKey`
  overwrites `apiKeyHash` and persists BEFORE composing the new token,
  so the old HMAC is invalid on the very next request. No listing or
  detail route emits `apiKeyHash` or a plaintext secret.
- **Daemon posture.** `agent/src/config.ts` requires `DOCKSTASH_URL`
  (no baked-in fallback); `agent/src/api-client.ts` emits no log lines
  and pino redaction covers `repo.password` + `ssh.privateKey`. The
  spawn helpers in `agent/src/{restic-runner,docker-client}.ts` and
  their server-side twins (`server/src/modules/backups/backups.restic-
  runner.ts`, `backups.docker-client.ts`) share a cross-copy parity
  meta-test — argv-only spawn, no `shell: true`, no
  `child_process.exec`, no `/var/run/docker.sock`, no `dockerode`.

## Command execution & SSRF (surface #6)

- **Argv-only spawn.** Every `child_process.spawn` in server AND agent code
  runs with `shell: false` and a `string[]` argv — never a concatenated
  shell string, never `shell: true`, never `child_process.exec`. Restic
  passwords travel via `env.RESTIC_PASSWORD`, not argv; a shell
  metacharacter in a project name or repo URL reaches restic as one inert
  argument. Enforced by ESLint (`no-restricted-syntax` on `shell: true`,
  `no-restricted-imports` on `exec` in `modules/backups/**` and
  `agent/src/**`) plus the meta-test at
  `server/src/shared/middleware/command-execution-meta.test.ts`.
- **SSH host-key pinning.** `backups.restic-runner.ts` and its agent copy
  set `-o StrictHostKeyChecking=yes` + a pinned `UserKnownHostsFile` that
  contains only the fingerprint stored in
  `STORAGE_SSH_HOST_KEY_FINGERPRINT`. Auto-accept (`=no` /
  `=accept-new`) is banned across the whole tree. The connection-test
  path (`settings.ssh-probe.ts`) fails closed if the pinned fingerprint is
  missing.
- **Docker socket-proxy only.** `/var/run/docker.sock` is bind-mounted
  only into `docker-socket-proxy` (RO, `cap_drop: ALL`,
  `no-new-privileges`, endpoint allowlist
  `CONTAINERS`/`EXEC`/`INFO`/`ALLOW_RESTARTS`+`POST`). The api reaches
  Docker via `DOCKER_HOST=tcp://docker-socket-proxy:2375` — no `dockerode`,
  no raw socket path anywhere else. `command-execution-meta.test.ts`
  fails if a new service ever mounts the raw socket.
- **SSRF guard on user URLs.** Every server-side `fetch` that takes a
  user-supplied URL — today, the per-project `alertWebhookUrl` and the
  operator `ALERT_WEBHOOK_URL` — routes through
  `shared/net/safe-fetch.ts::safeFetch`. `safeFetch`:
  (a) rejects non-`http:` / `https:` schemes;
  (b) resolves the host (IPv4 + IPv6) and rejects if any resolved address
      lies in loopback / private / link-local / cloud-metadata / IPv6
      unique-local (`fc00::/7`, `fe80::/10`, `::1`, `::`) ranges;
  (c) follows redirects manually and re-runs (a)+(b) on every hop, so a
      public URL that 302s to `127.0.0.1` still fails;
  (d) caps the chain at 5 hops.
  Not-covered residual: TOCTOU DNS re-bind between the guard resolve and
  Node's TCP connect. Mitigation there is DNS pinning at the socket layer,
  out of scope for surface #6.
- **zod-everywhere.** Every mutating route validates its body/params/query
  with a zod schema at the router boundary before Mongoose or spawn ever
  sees the input. No `as any`, no spreading `req.body` into a Mongoose
  filter or argv element.

## Blast radius / threat model

The `api` container is root-equivalent inside the Docker network: it reads
`/var/www` (read-only), holds a JWT signing secret, and can `exec` into any
tracked container via the socket-proxy. Mitigations:

- **Least privilege on Docker** — the proxy scopes the socket to the
  minimum set of endpoints the backup engine needs.
- **Read-mostly `/var/www`** — the api mounts it `:ro` for scan operations.
- **Path-traversal guards** — `backups.paths.ts::isAllowedProjectPath` +
  `assertAllowedPath` reject any path outside `ALLOWED_PATH_ROOT`.
- **Secrets encrypted at rest** — every provider token / restic password is
  wrapped in an AES-256-GCM envelope keyed by `MASTER_ENCRYPTION_KEY`.
- **Crown jewels** — the storage VPS holds the only copy of restic repos
  offsite. Its SSH host key is pinned. Loss of `MASTER_ENCRYPTION_KEY`
  makes every ciphertext in Mongo unrecoverable; back it up out-of-band.

## Secrets & data-at-rest (Surface #7)

Full rule: `.claude/rules/secrets-and-rotation.md`.

- **AES-256-GCM envelope** — `shared/crypto/encryptSecret` returns
  `{ ciphertext, iv, authTag, keyVersion }`. Every persisted secret (restic
  repo password, SSH private key, agent API secret) lands as an envelope in
  Mongo; no plaintext schema field. IV is `crypto.randomBytes(12)` per call
  — GCM's fatal IV-reuse mode is unreachable without going through the
  test-only `__setIvGeneratorForTests` seam.
- **Env-only master key** — `MASTER_ENCRYPTION_KEY` is required by the zod
  env schema (`config/env.ts`); a decode-failing key fails startup fast.
  There is no in-source default, no dev fallback.
- **Rotation runbook** — `shared/crypto/rotate.ts::rotateStore` iterates a
  store, decrypts each record with its own `keyVersion`, re-encrypts under
  the target, and swaps atomically per record. On any swap throw it
  returns `failedAt`; already-swapped records still decrypt under the
  still-registered new key; un-swapped records still decrypt under the
  still-registered old key. A re-run at the same target is a no-op — every
  record's `keyVersion` already equals target, and rotation skips.
- **pino redaction** — `config/logger.ts::REDACT_PATHS` covers
  `req.headers.authorization`, `req.headers.cookie`,
  `req.headers["x-csrf-token"]`, `res.headers["set-cookie"]`, the request-body
  fields on auth/settings/backups create, deep wildcards `*.password`,
  `*.token`, `*.secret`, `*.privateKey`, `*.apiKeyHash`, `*.ciphertext`,
  `*.iv`, `*.authTag`, and the env-derived globals `MASTER_ENCRYPTION_KEY`,
  `JWT_SECRET`, `SESSION_SECRET`, `RESEND_API_KEY`. Runtime
  proof: `config/logger-redaction.test.ts` writes each shape to a captured
  `Writable` and asserts every well-known secret collapses to `[REDACTED]`.
- **No stack on the wire** — `shared/middleware/error-handler.ts` returns
  `{ error: { message } }` for every 500; the stack is written to the
  redacted pino logger, never the response. The historical
  `NODE_ENV === 'development' ? { stack }` branch is gone.
- **Root `.env` only** — every runtime env var lives in the repo-root
  `.env`; there is no `.env` under `client/`, `server/`, or `agent/`.
  The meta-test enforces this by walking each subtree.
- **Self-backup password is derived** — `boot/recovery.ts::deriveSelfBackupPassword`
  HMAC-SHA256s the decoded master key with the fixed label
  `dockstash:self-backup:v1`. The restic subprocess only ever sees the
  derived 64-hex string; a restic `stderr` capture or a stolen
  self-backup repo image cannot yield `MASTER_ENCRYPTION_KEY`.

## Legal hold

`Project.legalHold` (`modules/backups/backups.model.ts`) and `User.legalHold`
(`modules/users/users.model.ts`) both default to false. When set:

- The retention `forget --prune` job (`scheduler.prune.service.ts`) returns
  early with a `security.legalHold.pruneSkipped` message — no snapshots are
  deleted.
- The account-deletion purge (`legal.service.ts::purgeAccount`) refuses to
  proceed on a held user and skips any held project.

## Injection & Output (surface #8)

Enforced by `.claude/rules/no-query-injection-and-i18n-errors.md` and the
static guard at
`server/src/shared/middleware/injection-and-output-meta.test.ts`:

- **No operator injection.** Every list/get/update/delete controller in
  `modules/**` zod-parses `req.body`/`req.query`/`req.params` BEFORE any
  Mongoose call; the parsed, typed object is used as the filter.
  `req.query`/`req.body`/`req.params` are NEVER spread into `.find(...)`
  / `.findOne(...)` / `.updateOne(...)` / `.updateMany(...)` /
  `.countDocuments(...)` / `.where(...)` / `.findOneAndUpdate(...)` /
  `.findOneAndDelete(...)`. Zod's default `.strip()` drops
  `$`-prefixed keys before they reach the DB; list surfaces use
  `.strict()` to reject them outright with a 400.
- **Every URL id is cast.** Every product schema uses an anchored
  `[0-9a-fA-F]{24}$` regex or
  `mongoose.isValidObjectId(...)` BEFORE Mongoose sees the id. Invalid
  input returns 400/404, never a CastError 500.
- **No user-controlled `$where` / `$regex` / `$expr`.** Grep-verified
  clean across `server/src/modules/**`; any regex search is anchored on
  caller-escaped input with a length cap.
- **Data-rights owner-scope + grace + `legalHold`.** `legal.controller.ts`
  passes `req.user.id` to `exportUserData` / `scheduleAccountDeletion`
  — never a body `userId`. Deletion enqueues a purge
  `ACCOUNT_DELETION_GRACE_HOURS` in the future via `PurgeQueue`; no
  synchronous hard delete. `purgeAccount` refuses on `user.legalHold`
  and skips `project.legalHold` — and, when it skips ANY project for a
  hold, it now leaves the `User` row intact rather than orphaning that
  project (prompt 13 / F8). See `docs/data-rights.en.md`.
- **Error output = i18n keys only.** `shared/middleware/error-handler.ts`
  returns `{ error: { message, details? } }` where `message` is an
  `Accept-Language`-resolved i18n key. `HttpError` messages that look
  like keys are translated; unknown throws resolve to `errors.internal`.
  The stack is logged (pino-redacted), never sent on the wire — even in
  `NODE_ENV=development`. No `err.stack`, no raw `err.message`, no
  `...err` in the response body.

## What is out of scope

No WAF, no SIEM, no pen-test engagement. Dockstash is self-hosted software:
there is no payment surface, no platform-operator tier, and no telemetry.
