# Dockstash Security Recon — STEP 1 Findings

Read-only recon output for `prompts/dockstash-security/00-recon-findings-opus-4.7.md`.
Prompts `01`–`08` consume this table and annotate rows with `— FIXED at file:line`
as they close them. Prompt `09` re-reads the final state.

**Scope covered:** all 8 threat surfaces from `prompts/SECURITY.md`.
**Method:** `security-auditor` agent, Read/Grep/Glob only, end-to-end code-path
reads from route mount → middleware → controller → service → model → queue/spawn.
**Confidence:** CONFIRMED = end-to-end trace verified. PLAUSIBLE = code path plausibly
exploitable but one link in the chain not fully proven.

---

## Findings table (Critical → Low, grouped by surface within band)

| id | title | file:line | surface | failure scenario | severity | confidence | fixed by |
|---|---|---|---|---|---|---|---|
| S7-01 | pino logger created with no `redact` config | server/src/config/logger.ts:6-16 | 7 | Any `logger.error({ err })` or `logger.info({ headers, payload })` call emits secret material verbatim. SECURITY.md-required redaction targets (Authorization, cookies, JWTs, passwords, `SUPERADMIN_PASSWORD`, `POLAR_*`, agent Bearer, `MASTER_ENCRYPTION_KEY`, SSH keys) all pass through untouched into stdout / log ingest. Any log-file leak, log-stream capture, or SIEM index yields live secret material. | Critical | CONFIRMED | 07 |
| S7-02 | pinoHttp mounted without req/res redaction — `Authorization` + `Cookie` headers logged on every request | server/src/app.ts:52-57 | 7 | `curl -H "Authorization: JWT eyJ..." /api/users/me` writes the raw JWT to the log line via pino-http's default `req` serializer (`req.headers.authorization`, `req.headers.cookie`). Same on `/api/agent/*` where the composite `dsa_<id>.<secret>` Bearer is logged verbatim → single log line = full agent identity for that owner. | Critical | CONFIRMED | 07 |
| S3-01 | `POST /api/backups` create path has no project cap check | server/src/modules/backups/backups.controller.ts:55-62 → server/src/modules/backups/backups.service.ts:65-90 | 3 | Free user (cap=1) POSTs `/api/backups` 500 times → 500 `Project` rows created. `assertProjectCap` only runs later inside `runBackup` (backups.service.ts:254) and the agent lease path (agent-jobs.service.ts:162). Order violates `parse → own → assertCapacity → reserve`; DB fill / entitlement drift by any authenticated tenant with no upstream limit. | High | CONFIRMED | 03 |
| S3-02 | `PATCH /api/scheduler/:id` bypasses schedules-allowed + frequency caps after downgrade | server/src/modules/scheduler/scheduler.service.ts:78-98 + server/src/modules/scheduler/scheduler.entitlements.ts:36-44 | 3 | Pro user creates schedule at `*/5 * * * *`, subscription lapses to Free (`schedules: false`, frequency `daily`). User PATCHes with `{cron:"* * * * *", enabled:true}` — `updateSchedule` writes both fields with zero entitlement check. Cron worker fires; `billingEntitlements.canEnqueue` only rejects `kind==='drill'`/`'mirror'`, never re-runs `assertScheduleAllowed`/`classifyCron`. Free tier now receives minute-cadence backups indefinitely. | High | CONFIRMED | 03 |
| S6-01 | SSRF in alert webhook: user-supplied `project.alertWebhookUrl` has no private-IP/loopback/metadata block; `fetch` follows redirects | server/src/modules/alerting/alert.service.ts:34-50 + server/src/modules/backups/backups.schema.ts:79-93 | 6 | Owner PATCHes `/api/projects/:id/alerts` with `{"webhookUrl":"http://169.254.169.254/latest/meta-data/iam/security-credentials/"}` (or `http://127.0.0.1:8080/api/superadmin/...`, `http://docker-socket-proxy:2375/containers/json`). Schema only enforces `z.string().url()` + http(s) regex — no rDNS/IP block. First induced job failure fires `sendFailureAlert`; `defaultWebhookPoster` calls global `fetch` with no `redirect:'manual'`, no per-hop IP recheck. Cloud metadata / internal services reachable; error path may log response bytes. Same attack via public 302 → loopback. | High | CONFIRMED | 06 |
| S1-02 | Rate limiter is in-memory per-process; multi-instance deployments bypass credential-mutation caps | server/src/shared/middleware/rate-limit.ts:29-73 | 1 | `express-rate-limit` constructed with no `store:` override → default `MemoryStore` per api container. Fine in shipped compose (single `api`), but two api pods behind a load balancer give `2 × env.RATE_LIMIT_AUTH_MAX` credential-stuffing attempts per window, `2 ×` on webhook pre-HMAC, `2 ×` on contact. Redis is already in the stack (`REDIS_URL`) but not wired as `rate-limit-redis` store. Inline comment acknowledges the constraint but no production path exists. — FIXED at server/src/shared/middleware/rate-limit.ts + rate-limit-redis-store.ts (server.ts wires `productionRedisStoreFactory` at boot; `buildStore()` returns the Redis store when `REDIS_URL` set AND `NODE_ENV !== 'test'`, falls back to in-memory otherwise; tests cover setter/getter, test-env short-circuit, unset-URL short-circuit, unset-factory short-circuit, null-store fallback, live-store dispatch to all five limiter kinds) | Medium | CONFIRMED | 01 |
| S3-03 | No unique index / atomic guard on Project count → TOCTOU once S3-01 is fixed | server/src/modules/backups/backups.model.ts:55-137 + server/src/modules/backups/backups.service.ts:254-258 | 3 | After S3-01 lands, two concurrent `POST /api/backups` at `remaining == 1` will both `countDocuments()` → `cap-1`, both pass `assertProjectCap`, both `Project.create` → cap+1 rows. No compound index (`owner, sequenceNumber<cap`), no transactional guard. PLAUSIBLE because unreachable while S3-01 leaves the create path uncapped; recorded so the 03 fix does not merely add an assert without an index. | Medium | PLAUSIBLE | 03 |
| S7-03 | Self-backup restic repo password is the raw `MASTER_ENCRYPTION_KEY` string | server/src/boot/recovery.ts:76-81 | 7 | `ProcessResticRunner` instantiated with `password: env.MASTER_ENCRYPTION_KEY`. Password passes via env (`RESTIC_PASSWORD`) — but any restic subprocess `stderr` capture, rejected promise `err.message`, or wrapped error surfaces through `logger.error({ err })`, which under S7-01 emits verbatim. Additionally: an attacker with restic-side access to the self-backup repo directory now holds the master key and can decrypt every project's `repoPasswordEnc`. | Medium | PLAUSIBLE | 07 |
| S8-01 | Legal export includes `repoPasswordEnc` ciphertext + envelope for every project | server/src/modules/legal/legal.service.ts:52,67-80 | 8 | `GET /api/legal/export` returns full at-rest envelopes (`ciphertext`, `iv`, `authTag`, `keyVersion`) by design. Combined with S7-03: an ever-leaked master key retroactively decrypts every archive a legitimate user ever downloaded. Combined with S7-02: a stolen JWT (visible in unredacted logs) pulls the ciphertext bundle in one request — normally these envelopes never leave the DB. | Medium | CONFIRMED | 08 |
| S8-02 | `LOG_LEVEL=trace` causes pino-http to emit request bodies verbatim (passwords, `repoPassword`, `privateKey`) | server/src/config/logger.ts:6 + server/src/app.ts:52-57 | 8 | Operator raises `LOG_LEVEL=trace` for debugging → pino-http's default `req` serializer captures full request bodies. `POST /api/auth/{register,login}` bodies contain plaintext passwords; `POST /api/backups` contains `repoPassword`; `POST /api/settings` contains `privateKey`. With no field-level `redact` (S7-01), one support-debug session durably stores every credential in log ingest. | Medium | PLAUSIBLE | 08 |
| S1-01 | Authenticated health routes bypass `requireVerified` gate | server/src/app.ts:94-98 + server/src/modules/health/health.routes.ts:23,32 | 1 | Fresh signup with unconfirmed email calls `GET /api/health/{projects,overview,alerts}` / `POST /api/health/alerts/read`. The two authenticated health sub-routers only apply `requireAuth`, not the `verified = [requireAuth, requireVerified]` chain that every other product surface uses (`app.ts:121-136`). Data is still owner-scoped, but the hard-gate invariant is silently violated. — FIXED at server/src/app.ts (both `projectHealthRouter` and `backupHealthRouter` mounted behind the shared `verified` array) + server/src/modules/health/health.routes.ts (redundant `router.use(requireAuth)` removed; gate applied at mount site to match every other product router). Meta-test at server/src/shared/middleware/security-meta.test.ts asserts the mount order. | Low | CONFIRMED | 01 |
| S1-03 | Non-enumerating auth surfaces still leak account existence via timing (write + email) | server/src/modules/auth/auth.service.ts:131-140, 155-177 | 1 | `resendVerification` / `generateResetToken` short-circuit on `!user`, but on a hit perform `user.save()` + `deliver{Password,Verification}Email` — status/body parity is enforced, but request-latency delta between "known" and "unknown" is stable across N samples → probabilistic enumeration oracle. — FIXED at server/src/modules/auth/auth.service.ts (`padAuthTiming(startedAt)` invoked on every branch — `unknown`, `alreadyVerified`, `sent`, hit, miss — so wall-clock responses are floored to `authTimingPadMs` = 400ms in prod). Injectable via `setAuthTimingPadMs()` for tests. Coverage exercises both the `remaining > 0` setTimeout branch and the fast-path branch. | Low | PLAUSIBLE | 01 |
| S2-01 | Owner-scoped loaders leak resource existence: 404 on missing, 403 on not-owned | server/src/modules/backups/backups.service.ts:96-108 + server/src/modules/scheduler/scheduler.service.ts:64-76 + server/src/modules/agents/agents.service.ts:87-99 | 2 | Any valid JWT: iterate ObjectIds against `GET /api/backups/:id` — 403 = another tenant's row, 404 = no row. Enumerable directory of every project/schedule/agent ever created, plus per-hit metadata via any downstream response-size delta. Prompt's stated policy for owner-scoped resources: prefer 404-cloak so existence isn't leaked. | Low | CONFIRMED | 02 |
| S2-02 | `stampProject` writes to a Project without re-asserting ownership at query time | server/src/modules/agents/agent-jobs.service.ts:265-315, 348 | 2 | `stampProject` does `Project.findById(projectId)` + `project.save()` — no owner filter. Safe today (`job.project` set server-side in `createAgentJob`, cannot be forged by a daemon). But a malicious daemon can pin `result.stats.totalRepoBytes` / `lastBackupBytes` to arbitrary values, poisoning `assertProjectCap` telemetry. Also: the invariant "every write joins owner at query time" is not honored for defense-in-depth. | Low | PLAUSIBLE | 02 |
| S2-03 | `listProjectJobsHandler` fetches `AgentJob.find({ project: projectId })` without owner join | server/src/modules/agents/agents.controller.ts:133-141 | 2 | Handler calls `loadOwnedProject(...)` first (safe response today), then `AgentJob.find({ project: projectId })` with no `owner: userId`. If a project is ever transferred, or a stale `AgentJob` survives an owner change, the query returns rows the new owner shouldn't see. Prompt required flagging exactly this `.find({ project })` shape. | Low | CONFIRMED | 02 |
| S7-04 | `errorHandler` returns `err.stack` in dev mode responses | server/src/shared/middleware/error-handler.ts:57-60 | 7 | An operator shipping an image with `NODE_ENV=development` (default in `.env.example`) exposes stack traces to any client that provokes a 500 — file paths, module boundaries, and any secret captured in the thrown error. Contained by the env gate → config-drift risk only. | Low | CONFIRMED | 07 |
| S8-03 | `ownerOfAgentJob` returns raw owner id; caller trust unverified in this recon | server/src/modules/agents/agent-jobs.service.ts:391-396 | 8 | Function validates `_id` shape (`/^[a-f0-9]{24}$/i`) then returns Project owner. Consumers include Socket.IO log-room authz — if any consumer treats a non-null return as "authorized" rather than comparing to the socket's authenticated user id, cross-tenant log stream subscription becomes possible. Consumer-side review deferred to 08. | Low | PLAUSIBLE | 08 |

**Surface 4 (Webhook & Payment Integrity — Polar): no findings.** All controls
(pre-json mount order, verify-before-parse, `timingSafeEqual` HMAC, replay window,
fail-closed on missing secret, `(provider,eventId)` unique-index idempotency,
refund/cancel post linked state, server-derived money) verified end-to-end.
See § "Positive controls verified" below for detail.

**Surface 5 (Fleet-agent machine surface): no findings.** Composite-token verify,
dummy-hash timing flatten, generic 401, per-agent scoping on every mutation, single-use
token issuance, rotation invalidates old hash, daemon uses configured `SERVER_URL`
and argv-only spawn everywhere. See § "Positive controls verified" for detail.

---

## Per-surface traces

### Surface 1 — Authentication & Session

**S1-01 — Authenticated health routes bypass `requireVerified`**
- Mount points: `server/src/app.ts:94-98` — `app.use('/api', healthRouter); app.use('/api/health/projects', projectHealthRouter); app.use('/api/health', backupHealthRouter);` — none go through the `verified` array.
- Every other product router at `app.ts:122-136` uses `app.use('/api/xxx', verified, xxxRouter)` where `verified = [requireAuth, requireVerified]`.
- Routers: `projectHealthRouter.use(requireAuth)` (`health.routes.ts:23`), `backupHealthRouter.use(requireAuth)` (`health.routes.ts:32`) — only `requireAuth`.
- Exploit: post-signup, `requireVerified` blocks `/api/backups`, `/api/scheduler`, … with `EMAIL_NOT_VERIFIED`. Same token authorizes `/api/health/{overview,alerts}` for the account's data → gate inconsistent, invariant advertised in the `verified` comment broken.

**S1-02 — In-memory rate limiter**
- `server/src/shared/middleware/rate-limit.ts:29-73` — every `createXxxRateLimiter` returns `rateLimit({...commonOptions, windowMs, max})` with no `store` → default `MemoryStore`.
- Inline comment (lines 25-28): "in-memory store — required for test isolation". No production override.
- Mount points: `app.ts:106` (auth), `:65` (webhook), `:112` (contact), `:116` (agent).
- Exploit: two api pods behind LB → independent buckets → doubled credential-mutation budget; forged Polar signatures get 2× headroom before HMAC math short-circuits. Redis runs in compose but is not wired via `rate-limit-redis`.

**S1-03 — Timing enumeration on forgot/resend**
- `auth.service.ts:135-136` returns early on `!user` for `resendVerification`; on hit, executes `issueVerificationToken` + `user.save()` + email deliver.
- `auth.service.ts:162-176` — same shape for `generateResetToken`.
- Controllers (`auth.controller.ts:45-50, 126-132`) return identical bodies either way → status parity correct.
- Exploit: write-then-send-email path takes tens-hundreds ms; not-found path returns synchronously. Repeated samples cluster into two populations.

**Positive controls verified (no findings):**
- Polar webhook raw-body route mounted BEFORE `express.json(...)` — `app.ts:63-69`.
- JWT strategy pins `algorithms: ['HS256']` — `passport.strategies.ts:42`; no hand-parsed tokens; `require-auth` uses only `passport.authenticate('jwt', {session:false})`.
- CORS is `origin: env.CLIENT_URL, credentials: true` — `app.ts:73`.
- CSRF double-submit, exempts `Authorization` header (`csrf.ts:22-23`), `secure: env.NODE_ENV === 'production'` (`csrf.ts:44`).
- Password reset + email verify tokens are CSPRNG (48 bytes) SHA-256-hashed at rest (`auth.service.ts:37-39, 45-46, 166-168`); raw only in outbound email; TTLs bounded.
- Superadmin OTP step-up in live login path (`auth.controller.ts:90-108`) and OAuth callback (`oauth.controller.ts:100-113`); no JWT issued before OTP verifies.

### Surface 2 — Cross-Account / IDOR Isolation

**S2-01 — 403 vs 404 existence leak**
- Shape (identical in 3 loaders):
  ```
  const project = await Project.findById(projectId);
  if (!project) throw HttpError.notFound(t('backups.error.projectNotFound'));
  if (project.owner.toString() !== userId) throw HttpError.forbidden(t('backups.error.notOwner'));
  ```
  `backups.service.ts:96-108`, `scheduler.service.ts:70-75`, `agents.service.ts:93-98`.
- Attacker: iterate ObjectIds against `GET /api/backups/:id`, inspect status.

**S2-02 — `stampProject` unscoped write**
- `agent-jobs.service.ts:330-346` — `completeJob` narrows by `{_id: jobId, agent: principal.id, status: 'leased'}` (correct).
- Line 348: `await stampProject(String(job.project), job.kind, result, now);`
- `stampProject` (`agent-jobs.service.ts:265-315`): `Project.findById(projectId)` — no owner join. Flips `project.lastStatus/snapshotCount/totalRepoBytes/lastBackupBytes` from daemon-supplied `result.stats` and persists.
- Safe today because `job.project` is server-authored at `createAgentJob` (line 60-72), and claim-time check verifies `project.owner === principal.owner` (line 152). Malicious daemon can still pin its own project's stats to arbitrary values → poisons plan-cap telemetry.

**S2-03 — List jobs missing owner join**
- `agents.controller.ts:133-141`:
  ```
  const userId = requireUserId(req.user);
  const { projectId } = listJobsQuerySchema.parse(req.query);
  await loadOwnedProject(projectId, userId, { t: req.t });
  const jobs = await AgentJob.find({ project: projectId }) ...
  ```
- Ownership checked at `loadOwnedProject` (response is safe today). Query itself misses `owner: userId`.

**Positive controls verified:**
- backups (`loadOwnedProject`), scheduler (`loadOwnedSchedule`), agents (`loadOwnedAgent`), settings (`StorageSettings.findOne({owner: userId})` — settings.service.ts:31/39/76/129/143/164), audit (`AuditLog.find({actorUserId: userId})` — audit.service.ts:62), health alerts (`{owner,...}`), legal (`User.findById(userId)` from `req.user.id`).
- Agent `/api/agent/*` correctly scopes every mutation by `principal.id`.
- Recovery/import cross-owner protection correct (`recovery.import.ts:87,108-111`).
- `/api/superadmin` gated `[requireAuth, requireVerified, requireRole(ROLE_SUPERADMIN)]` — `app.ts:136`.

### Surface 3 — Plan Caps / Entitlement Bypass

**S3-01 — Uncapped create path**
- `backups.controller.ts:55-62` (`create`) → `backups.service.ts:65-90` (`createProject`). Only `assertMultiVpsAllowed` runs, only when `input.agentId` is present. `assertProjectCap` (`entitlements.service.ts:109-124`) invoked only from `backups.service.ts:254` (`runBackup`) and `agent-jobs.service.ts:162` (agent lease).
- `SECURITY.md §3` requires assert "at the API layer BEFORE the domain record is reserved".

**S3-02 — PATCH bypasses caps**
- `scheduler.routes.ts` mounts PATCH → `scheduler.controller.ts:93-100` (`patch`) → `scheduler.service.ts:78-98` (`updateSchedule`).
- `createSchedule` (`scheduler.service.ts:32-58`) correctly calls `assertScheduleAllowed(userId, { frequency: classifyCron(cron) })`. Update path is missing that call entirely.
- `billingEntitlements.canEnqueue` (`scheduler.entitlements.ts:37-43`) returns `true` for `kind==='backup'` regardless of frequency — docstring at lines 30-34 concedes it does NOT re-check frequency for "legacy schedules created before a downgrade".
- Zod: `scheduler.schema.ts:56-65` accepts free-form `cronString`. Retention writes as-is (`clampRetentionPolicy` runs only in prune path).

**S3-03 — TOCTOU without unique index**
- `backups.model.ts:55-137` declares `owner: { index: true }` (non-unique), no compound index.
- `entitlements.service.ts:115-122`: read count via `deps.countActiveProjects(userId)`, throw if `activeCount > cap`.
- Callers use `Project.countDocuments({owner, paused: {$ne:true}})`, no transaction.

**Positive controls (Surface 3):**
- Tiered definitions resolved from `plans.ts` + pricing-tier model; no ad-hoc numeric limits found in feature modules.
- Money server-derived: `webhook/registry.ts:83` uses `getPlanForProductId(norm.productId)`; client-supplied `productId` on checkout/change-plan validated by `assertKnownProduct` (`billing.service.ts:28-35`).

### Surface 4 — Webhook & Payment Integrity (Polar)

**No findings.** Reviewed:

- **Mount order**: `app.ts:63-69` mounts `POST /api/billing/webhook` with `createWebhookRateLimiter()` → `express.raw({type:'*/*', limit:'1mb'})` → `webhookHandler`, before `app.use(express.json(...))` at line 69. Limiter comes from `rate-limit.ts:41-47` (pure `express-rate-limit`, doesn't touch body).
- **Verify-before-parse**: `webhook/ingest.ts:44-55` calls `provider.verifyWebhook(rawBody, headers)` before `provider.parseEvent(...)` at lines 58-69. JSON parsing scoped inside `polar.parseEvent` (`providers/polar.ts:276-284`) after verify.
- **HMAC**: `providers/polar.ts:258-266` uses `timingSafeEqual` with length pre-check. Length mismatch skips (`continue`), never `===` on Buffer.
- **Replay window**: `providers/polar.ts:245-252` enforces `Math.abs(now - tsSeconds) > REPLAY_TOLERANCE_SECONDS` → 401.
- **Missing-secret fails closed**: `providers/polar.ts:234-238` throws `WebhookVerifyError('POLAR_WEBHOOK_SECRET is not configured', 500)`; `ingest.ts:47-51` maps to `{statusCode:500, body:{status:'invalid'}}`; no `WebhookEvent` row, no state mutation. Test coverage: `providers/polar-extra.test.ts:184-189`.
- **Idempotency**: `webhook-event.model.ts:53` unique compound `(provider, eventId)`. `ingest.ts:74-108` insert-first dedupe; duplicate-key caught; re-dispatch only when `existing.status === 'failed' && retryCount < MAX_WEBHOOK_RETRIES`. Downstream `webhook/registry.ts::upsert*` all idempotent `findOneAndUpdate` keyed on `provider*Id`. `handleUpgrade/handleDowngrade` in `lifecycle.service.ts` fire only when `priorSub.planSlug !== planSlug` → no double-grant on retry.
- **Refund/cancel**: `webhook/registry.ts:236-240` calls `handleRefund`; `upsertSubscription` writes `status:'canceled'/'revoked'` at `registry.ts:206-208` — never `deleteOne`.

Ancillary hygiene (not findings):

- `WebhookVerifyError` with `status=500` on missing secret is fail-closed but returns 500 → Polar retries indefinitely. Consider 401/503 for operator-noise reduction. Not a security bug.
- `resolveUserId` (`registry.ts:37-52`) falls back to email lookup when `externalCustomerId` absent. Safe because HMAC gate prevents forged events and `polar.ts:202` sets `external_customer_id` from server-side authenticated `input.userId`. Worth pinning as a `providers/*.test.ts` invariant.

### Surface 5 — Fleet-Agent Machine Surface

**No findings.** Reviewed:

- **Composite-token verify**: `require-agent-auth.ts:19-58`. Regex anchored `/^dsa_([0-9a-f]{24})\.([0-9a-f]{48})$/`. Unknown-id path pays HMAC cost against `getDummyRecord()` (line 46-48). `verifyApiSecret` uses HMAC-SHA256 + `timingSafeEqual` with length guard (`crypto/index.ts:114-121`). ALL failure paths throw the same `agents.error.unauthorized`.
- **Per-agent scoping**: `claimNextJob` filters `{agent: principal.id, status: 'pending'}` (`agent-jobs.service.ts:139-148`); post-claim verifies `project.owner.toString() === principal.owner` (line 152). `appendJobLogs` / `completeJob` scope `{_id: jobId, agent: principal.id, status: 'leased'}` (lines 244, 331) — no lookup by job id alone.
- **Token lifecycle**: `registerAgent` returns `token` once, stores only `hashApiSecret(secret)` (`agents.service.ts:71-80`). `rotateAgentKey` overwrites `apiKeyHash` before returning fresh token (lines 108-111) — old HMAC invalid on next request. No route echoes an existing secret.
- **Agent daemon**: `AgentApiClient` reads baseUrl from config (`DOCKSTASH_URL`, `api-client.ts:39-42`); Bearer never logged. `executor`/`backup.ts`/`restic-runner.ts` on agent side use argv-only spawn + `assertArgvSafe` (NUL byte guard) + `isAllowedProjectPath` on every server-supplied path token.

### Surface 6 — Command Execution / SSRF / Input Validation

**S6-01 — SSRF via alert webhook**
- Writer: `backups.service.ts:171` (`project.alertWebhookUrl = webhookUrl`). Model default `''` at `backups.model.ts:111`.
- Schema: `alertsConfigSchema` in `backups.schema.ts:79-93` — only `z.string().url()` + `/^https?:\/\//i`.
- Poster: `alert.service.ts:34-50` — `defaultWebhookPoster` uses global `fetch`, no `redirect: 'manual'`, no allowlist, no per-hop IP recheck.
- Target loop: `alert.service.ts:136-151`.
- Exploit: DNS attacker serves A record → `169.254.169.254`, or `http://mongo:27017`, `http://docker-socket-proxy:2375/containers/json`, `http://127.0.0.1:8080/api/superadmin/…`. Public 302 → loopback works too. Gated on `paidAlertsAllowed` and requires the owner to induce a project failure → severity High rather than Critical.

**Positive controls (Surface 6):**
- `backups.restic-runner.ts:107-152, 201-257`: `child_process.spawn` argv-only via injected `spawnImpl` (default `nodeSpawn`); no `shell:true`, no `exec`. Password via `env.RESTIC_PASSWORD`, never argv (lines 116-118, 206-208). SFTP forces `StrictHostKeyChecking=yes` + `UserKnownHostsFile=<pinned>` + `BatchMode=yes` (lines 149, 247); `keyPath`/`knownHostsPath` are `mkdtemp` server-generated.
- `backups.ssh-transport.ts:36-69`: `PinnedSshTransport` rejects fingerprints failing `FINGERPRINT_SHAPE`; `verifyHostKey` compares stored pinned fingerprint, throws on mismatch — no auto-accept path exists.
- `settings.ssh-probe.ts:50-113`: argv-only spawn; `host`/`user` protected by anchored `HOST_SHAPE`/`USER_SHAPE` (`settings.schema.ts:8-13`) — leading-`-` argument-injection blocked; `StrictHostKeyChecking=yes` + pinned `UserKnownHostsFile` on auth check.
- `backups.docker-client.ts:38-46, 231-430`: only path to Docker is `parseDockerHost(env.DOCKER_HOST)` → HTTP to `tcp://docker-socket-proxy:2375`; no dockerode, no raw socket, no `/var/run/docker.sock`. Container id `encodeURIComponent`-wrapped (lines 250, 344, 400). Argv JSON-encoded as `Cmd` — never shell string.
- `docker-compose.yml:73-74`, `agent/docker-compose.agent.yml:22`: `/var/run/docker.sock` bind-mounted **only** into least-privilege `docker-socket-proxy` (RO, `cap_drop: ALL`, `no-new-privileges`, endpoint allowlist `CONTAINERS/EXEC/INFO/ALLOW_RESTARTS/POST`). api uses `DOCKER_HOST: tcp://docker-socket-proxy:2375` (line 142); no raw socket mount anywhere.
- `agent/src/backup.ts:20-32, 88-171`: `assertArgvSafe` NUL-guard on every argv slice; `isAllowedProjectPath` re-validates every `plan.paths`/`plan.configs` entry (`paths.ts:67-80` — rejects relative/`..`/NUL/`/`/out-of-roots).
- `agent/src/restic-runner.ts`: vendored copy of server runner — same argv-only + env-password + pinned host-key options.
- Zod-validation on every `/api/agent` handler (`agent-api.controller.ts:36, 87, 88, 96` — `agentHeartbeatCoreSchema` / `agentJobIdParamsSchema` / `agentJobLogsSchema` / `agentJobResultSchema`).
- Server outbound `fetch` inventory: `resend.ts` (env-configured), `docker-client.ts` (Docker over internal proxy), `alert.service.ts` (S6-01 hole). No other user-URL fetch surface.

### Surface 7 — Secrets & Data-at-Rest

**S7-01 — No pino redact**
- `server/src/config/logger.ts:6-16` — pino instantiated with no `redact` config. Every `logger.error({ err })`, `logger.info({ headers })`, `logger.warn(payload)` call app-wide is unprotected.
- SECURITY.md-required targets not covered: `Authorization`, cookies, JWTs, passwords, `SUPERADMIN_PASSWORD`, `POLAR_*`, agent Bearer, `MASTER_ENCRYPTION_KEY`, SSH keys.

**S7-02 — pino-http headers unredacted**
- `app.ts:52-57` mounts `pinoHttp({ logger, customProps })` with the S7-01 logger. Default `req` serializer includes `headers` (authorization, cookie). No `serializers`, no `redact`, no `wrapSerializers` override.
- Reproduction: `curl -H "Authorization: JWT eyJ..." /api/users/me` → log line contains token verbatim. Same for `/api/agent/*` `dsa_...` composite tokens.

**S7-03 — Self-backup password is master key**
- `boot/recovery.ts:76-81` — `ProcessResticRunner({ repoUrl: env.SELF_BACKUP_REPO, password: env.MASTER_ENCRYPTION_KEY })`.
- Chained with S7-01: restic child `stderr` / rejected-promise `err.message` reaches `logger.error` → master key propagates to log ingest.
- Also: anyone with restic-side access to the self-backup repo directory now holds the master key that decrypts every project's `repoPasswordEnc`/`sshKeyEnc`.

**S7-04 — Dev-mode stack leak**
- `shared/middleware/error-handler.ts:57-60` — attaches `stack: err.stack` when `env.NODE_ENV === 'development'`.
- Only triggered under dev mode; risk is `NODE_ENV=development` from an example `.env` shipping to prod → any 500 leaks internal paths, module boundaries, and any secret embedded in thrown error.

**Positive controls (Surface 7):**
- `shared/crypto/`: AES-256-GCM envelopes verified. `encryptSecret`/`decryptSecret` keyed by `MASTER_ENCRYPTION_KEY`. Rotation via `keyRegistry.ts` + `rotate.ts::rotateStore`, idempotent when `keyVersion == target`. No hardcoded key.
- Superadmin seed (`superadmin/superadmin.seed.ts:32-49`): idempotent, never overwrites, does not log the password.
- No `.env` outside repo root; no hardcoded URLs (per governance rules).

### Surface 8 — Injection & Output

**S8-01 — Legal export ships ciphertext bundle**
- `legal.service.ts:52` `Project.find({ owner: userId })` scopes correctly (no cross-tenant). Per-project `repoPasswordEnc: p.repoPasswordEnc` (line 72) exports the full envelope into the JSON download. Intent documented at lines 28-31.
- Chain risk: stolen JWT (visible in unredacted logs — S7-02) pulls ciphertext bundle in one request. Ever-leaked master key (S7-03) retroactively unlocks every past export.

**S8-02 — LOG_LEVEL=trace body echo**
- `config/env.ts` declares `LOG_LEVEL`; `logger.ts` passes to pino. `app.ts:52-57` wires `pinoHttp` with no `redact`/`serializers` override.
- At `trace`, pino-http default `req` serializer includes body. `POST /api/auth/{register,login}` bodies contain `password`; `POST /api/backups` contains `repoPassword` (schema `backups.schema.ts:40` ≥8 chars); `POST /api/settings` contains `privateKey`.

**S8-03 — `ownerOfAgentJob` return trust**
- `agent-jobs.service.ts:391-396` validates `_id` shape then returns Project owner id. File-alone is safe (id shape validated before Mongo → no operator injection). Consumers (Socket.IO log-room authz) must compare to socket's authenticated user id, not treat non-null as "authorized". Consumer-side review deferred to `08`.

**Positive controls (Surface 8):**
- Every controller uses `zod.parse(req.body/params/query)` before Mongoose.
- No `Model.find` in `server/src/modules` builds filter from unsanitized `req.body`/`req.query`.
- `serializeProject`/`toPublicUser`/`serializeStorage` omit all `*Enc` and `password*` fields.
- `error-handler` returns i18n keys only in production (`env.NODE_ENV !== 'development'`).
- Superadmin router `[requireAuth, requireVerified, requireRole(ROLE_SUPERADMIN)]` (`app.ts:136`).

---

## Routing to fix prompts

| Fix prompt | Owns findings |
|---|---|
| `01-auth-session-passport-jwt-opus-4.7.md` | S1-01, S1-02, S1-03 |
| `02-cross-account-idor-isolation-opus-4.7.md` | S2-01, S2-02, S2-03 |
| `03-plan-caps-entitlement-bypass-opus-4.7.md` | S3-01, S3-02, S3-03 |
| `04-webhook-payment-integrity-polar-opus-4.7.md` | (none — surface clean; prompt should re-verify and pin invariants) |
| `05-fleet-agent-machine-surface-opus-4.7.md` | (none — surface clean; prompt should re-verify and pin invariants) |
| `06-command-execution-ssrf-input-validation-opus-4.7.md` | S6-01 |
| `07-secrets-data-at-rest-opus-4.7.md` | S7-01, S7-02, S7-03, S7-04 |
| `08-injection-and-output-opus-4.7.md` | S8-01, S8-02, S8-03 |

## Idempotency contract

Re-runs MUST reconcile in place (re-verify each row; annotate `— FIXED at
file:line` when closed; never silently delete a finding; never downgrade
CONFIRMED → PLAUSIBLE without an end-to-end trace showing the original read was
wrong). A clean re-run appends a single `re-verified YYYY-MM-DD — no new
findings` line at the top of this file.
