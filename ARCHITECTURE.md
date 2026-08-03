# Architecture

Living map of what exists in the codebase today. Prompts append here as they
land; this doc is not a design brief.

## Server modules

| Module | Mount | Purpose |
|--------|-------|---------|
| `auth` | `/api/auth`, `/api` (`protectedRouter`) | Passport JWT + local strategies, register/login/reset flows |
| `users` | `/api/users` | Authenticated profile lookup, role helpers |
| `communication` | `/api/communication` | Transactional email / mailers (Resend transport since prompt 08) |
| `backups` | `/api/backups` | Project scanning, plan management, backup orchestration |
| `alerting` | (no HTTP surface) | Failure alerts + dead-man's-switch heartbeat sweep |
| `audit` | `/api/audit` | Append-only audit log (owner-scoped read) |
| `health` | `/api/health`, `/api/metrics`, `/api/health/projects` | Liveness + aggregate metrics + per-project last-success surface |
| `recovery` | `/api/recovery` | Config export / import + install-wide self-backup of the orchestrator Mongo (Admin-gated) |
| `scheduler` | `/api/scheduler` | Cron schedules, ad-hoc enqueue, retention prune, live job logs |
| `agents` | `/api/agents`, `/api/agent` | Fleet-agent registry + the machine surface daemons poll |
| `legal` | `/api/legal` | GDPR data export + account deletion with grace window and legal hold |
| `settings` | `/api/settings` | Storage target, retention defaults, encryption password |

## Shared services

- `shared/crypto/` — AES-256-GCM envelope for secrets at rest, keyed by
  `MASTER_ENCRYPTION_KEY`. `encryptSecret` / `decryptSecret` / `reEncryptSecret`.
- `shared/i18n/` — hand-written dictionaries in seven locales (`en`, `ar`, `fr`,
  `de`, `es`, `ru`, `zh`) plus `resolveLanguage`, `translate`, `verifyKeyParity`.
- `shared/testing/mongo.ts` — in-process `mongodb-memory-server` harness.
- `shared/utils/http-error.ts` — `HttpError` factory (`.badRequest` /
  `.unauthorized` / `.forbidden` / `.notFound` / `.conflict` / `.internal`).

## Observability (prompt 08)

- **Resend transport** — `communication/mailers/resend.ts` replaces the old
  Mailgun transport but keeps the neutral `sendEmail(message)` signature.
  `RESEND_API_KEY` + `RESEND_FROM` are optional; when unset, `sendEmail` logs
  and returns `{ delivered: false }` — never crashes the caller.
- **Localized transactional templates** — `communication.service.ts` renders
  `welcome`, `paymentReceipt`, `dunning`, `passwordReset`, `passwordChanged`,
  and the four alert kinds via the `t(key, vars)` helper. Recipient language
  comes from `User.language` (fallback: `DEFAULT_LOCALE`).
- **Failure alerts** — `alerting/alert.service.ts` `sendFailureAlert()` fires
  on every failed backup / restore / drill. Sends a localized Resend email +
  optional JSON POST to `ALERT_WEBHOOK_URL`. Best-effort: any transport
  failure is logged, never re-thrown, so the orchestrator is never masked.
- **Dead-man's-switch heartbeat** — `alerting/heartbeat.service.ts`
  `runHeartbeatSweep()` alerts every project whose last-good is older than
  `ALERT_HEARTBEAT_HOURS` (or that never succeeded). Dedupes via
  `Project.lastHeartbeatAlertAt`. Registered on the scheduler cron
  (`0 * * * *`) as `__heartbeat__`; cancelled on shutdown.
- **Audit log** — `audit/audit-log.model.ts` `AuditLog` collection: append-only,
  captures actor, action (`backup.run` / `backup.restore` / `backup.delete` /
  `plan.change`), target, source IP (from `X-Forwarded-For` behind the trusted
  proxy), and timestamp. Read via `GET /api/audit` (owner-scoped).
- **Health surface** — `health/health.service.ts` `runHealthCheck()` returns
  `{ status, db, redis, timestamp }`. Endpoints:
  - `GET /api/health` — unauthenticated readiness (200 / 503).
  - `GET /api/metrics` — aggregate project counters.
  - `GET /api/health/projects` — owner-scoped per-project `lastSuccessAt` /
    `lastDrillAt` for the dashboard health column.

## Backups module

Files under `server/src/modules/backups/`:

- `backups.model.ts` — `Project` Mongoose schema. Owner-scoped, holds the
  detected `plan` and an encrypted `repoPasswordEnc`. `InferSchemaType`-typed.
- `backups.paths.ts` — `/var/www/*` allowlist guard. Rejects non-absolute
  paths, `..` traversal, NUL bytes, `/var/www` itself.
- `backups.adapters.ts` — adapter registry. `postgresAdapter`,
  `mariadbAdapter`, `mysqlAdapter`, `mongoAdapter`. `matchAdapter(image)` picks
  the first matching one. Every `dumpCmd` / `restoreCmd` returns a `string[]`
  argv, never a shell string.
- `backups.scan.ts` — `scanProject(projectPath, opts?)`. Reads
  `docker-compose.yml`, resolves adapters per service, records proxy config
  paths, returns `{ paths, databases, configs }`. `readFile` is injectable so
  fixtures drive tests.
- `backups.boundaries.ts` — injectable interfaces only: `ResticRunner`,
  `DockerClient`, `SshTransport`, `DiskSpaceProbe`. Orchestration depends on
  these; concrete impls plug in at wire-up.
- `backups.service.ts` — the run loop. `createProject`, `loadOwnedProject`,
  `listProjectsForUser`, `scanProjectPath`, `updateProjectPlan`, `runBackup`.
  Every layer either succeeds or the whole run is marked `failed` — no
  partial-success snapshots.
- `backups.controller.ts` + `backups.routes.ts` — HTTP surface. Every route is
  behind `requireAuth`; every project resource passes an ownership check.
- `backups.serialize.ts` — the public JSON shape. `repoPasswordEnc` is
  deliberately absent.

### `Project` collection

| Field | Type | Notes |
|-------|------|-------|
| `owner` | `ObjectId → User` | Indexed. Ownership check on every load. |
| `name` | `string` | Human label. |
| `path` | `string` | Must be under `/var/www/*`. |
| `plan.paths` | `string[]` | Extra host paths to include. |
| `plan.databases[]` | `{ service, type, container, enabled }` | Adapter-typed. |
| `plan.configs` | `string[]` | Reverse-proxy config paths. |
| `repoPasswordEnc` | `EncryptedSecret` | AES-256-GCM envelope; never returned. |
| `lastStatus` | `'idle' \| 'running' \| 'success' \| 'failed'` | Per-run status. |
| `lastError` | `string` | Raw diagnostic — used for alerting. |
| `lastRunAt` | `Date` | Wall time of the last transition. |

### Backup-run contract

1. Load and own-check the project.
2. Validate every path in the plan against the allowlist (defence in depth
   against a drifted DB record).
3. Optionally probe free disk space; abort early if below the threshold.
4. Decrypt the repo password in-process.
5. For every enabled DB layer: `docker exec <container> <dumpCmd>` streamed
   into `restic backup --stdin --stdin-filename <svc>.dump`.
6. `restic backup` over the plan's paths and configs in one pass.
7. Persist success. Any thrown error → mark `failed` with the raw diagnostic
   and rethrow a localized `HttpError.internal`.

## Backup verification

Files under `server/src/modules/backups/`:

- `backups.verify.service.ts` — `runResticCheck` (structure integrity via
  `restic check`, plus optional `--read-data-subset=<pct>` for data integrity)
  and `runRestoreDrill` (restore the latest snapshot to an isolated scratch
  workspace, byte-diff files, row-diff databases). A green drill is the only
  proof a backup restores. `runScheduledChecks` / `runScheduledDrills` are the
  entry points the scheduler (prompt 05) invokes on a cron.
- `backups.verify.controller.ts` + `POST /:id/check`, `POST /:id/drill` in
  `backups.routes.ts` — on-demand triggers for an operator. `HttpError.internal`
  if the boundary factories are not configured at wire-up time.
- `backups.boundaries.ts` extensions — `ResticRunner.check` / `.restore`,
  `ScratchWorkspace` (create+remove, tolerating a missing path),
  `FileDiffer.diff(sourceRoot, restoredRoot)` (byte/hash-diff),
  `DbDiffer.diff({container, service, restoredDumpPath})` (row-diff or
  parse-the-dump). Every impl plugs in behind these interfaces so both unit
  tests and the real-restic integration test drive the same code path.

### `Project` verification fields

| Field | Type | Notes |
|-------|------|-------|
| `lastCheckAt` | `Date \| null` | Wall time of the last `restic check`. |
| `lastCheckStatus` | `'pass' \| 'fail' \| null` | Never `pass` unless restic exited zero. |
| `lastCheckDetail` | `string` | Localized human-readable message. |
| `lastDrillAt` | `Date \| null` | Wall time of the last restore drill. |
| `lastDrillStatus` | `'pass' \| 'fail' \| null` | Only `pass` when byte + row diffs are clean. |
| `lastDrillDetail` | `string` | Localized summary — includes mismatch count on `fail`. |

### Restore-drill contract

1. Load and own-check.
2. Fetch snapshots. Empty list → mark `fail` with `backups.drill.nothingToRestore`.
3. Create scratch; `restic restore latest --target <scratch>`.
4. For each source path/config: `FileDiffer.diff(source, scratch)` → sum mismatches.
5. For each enabled DB layer: `DbDiffer.diff({..., restoredDumpPath: scratch/svc.dump})`.
6. Total mismatches == 0 → `pass`; otherwise `fail` with a localized count + detail.
7. Scratch is removed in `finally` even when the drill throws.

### Failure-injection + real-restic tests

- `backups.failure.test.ts` drives `runBackup` / `runRestoreDrill` with mock
  boundaries configured to inject each fault (kill mid-backup stream, fill disk
  `ENOSPC`, connection error, stale restic lock, torn dump). Every scenario
  asserts the negative — `lastStatus` / `lastDrillStatus` MUST be `failed` /
  `fail`, never `success` / `pass`.
- `backups.restic-integration.test.ts` runs against the real `restic` binary in
  a throwaway local repo — gated with `describe.skipIf(!hasRestic())`. It seeds
  a file tree, backs it up, restores to scratch, and asserts the round-trip
  byte-diff is clean. Also exercises real exit codes / lock behavior with two
  concurrent operations.

## Scheduler (prompt 05)

Serialized job queue + node-cron triggers + Socket.IO live logs for the
backup / prune / check / drill workload.

### The `Schedule` collection

| Field | Type | Notes |
|-------|------|-------|
| `project` | `ObjectId → Project` | Indexed. |
| `owner` | `ObjectId → User` | Indexed. |
| `kind` | `'backup' \| 'prune' \| 'check' \| 'drill'` | |
| `cron` | `string` | Validated by `node-cron` at create/update. |
| `retention.{keepDaily,keepWeekly,keepMonthly}` | `number` | For `prune` jobs. |
| `enabled` | `boolean` | Disabled schedules do not register a cron. |
| `lastEnqueuedAt` | `Date \| null` | Stamped on cron fire and `/enqueue`. |
| `lastRunStatus` | `'idle' \| 'queued' \| 'running' \| 'success' \| 'failed'` | Updated by the worker. |

### One job per repo

`SchedulerQueue` (interface in `scheduler.boundaries.ts`) guarantees per-repo
serialization:

- **Prod backend** (`BullmqQueueBackend`) — one BullMQ `Queue` + `Worker` per
  `projectId` with `concurrency: 1`. Different projects → different queues →
  parallel; same project → serial.
- **In-memory backend** (`MemoryQueue`) — per-project promise chain used by
  tests (no redis dependency).

Concurrent restic operations on the same repo would corrupt the repo, so this
is a correctness invariant, not an optimization.

### Retention → `forget` flag mapping

`pruneArgs({ keepDaily, keepWeekly, keepMonthly })` →
`['forget', '--prune', '--keep-daily', n, '--keep-weekly', n, '--keep-monthly', n]`

Prune is its own `kind` with its own job — never invoked inline from a backup.

### Stale-lock recovery

Before every retry attempt, `recoverStaleLockIfOrphaned` inspects the queue.
If **no other live job** holds the repo (`active <= 1` — this job itself),
`restic unlock` runs. Any active concurrent job → skip (defensive; the queue
already prevents true concurrency).

### Retry + backoff + alert hook

`processJob` retries up to `maxAttempts` with exponential backoff
(`baseBackoffMs * 2^(n-1)`). Final failure marks the schedule `failed`, emits
a terminal `failed` event to the log room, and calls the injected `AlertHook`
(swallowed if the hook itself throws).

### node-cron

`NodeCronScheduler` wraps `node-cron`. `reconcileCron` reads the `Schedule`
collection on boot and after any mutation — one cron entry per enabled
schedule, exactly once. Disabled or deleted schedules are unregistered.
Registration is idempotent (replace-in-place).

### Live logs (Socket.IO room contract)

- Namespace: `/scheduler` on the retained `io` server (no second Socket.IO
  server is ever created).
- Auth: JWT (same secret as `requireAuth`). Unauth'd sockets are rejected.
- Room: `backup-logs:<jobId>`. A socket may join only if
  `ownership.ownerOf(jobId) === socket.userId`. Non-owners get
  `{ ok: false, reason: 'forbidden' }`.
- Events: `log { jobId, line }`, then a terminal `done { ok: true }` or
  `failed { ok: false, detail }`.

### `REDIS_URL`

Optional. When set, `BullmqQueueBackend` is used; without it the in-memory
backend runs (single-node only). Prod compose always sets it via the `redis`
service on the internal network.

## Recovery module (prompt 09)

Disaster recovery of the orchestrator itself: self-backup of the orchestrator
Mongo + a portable config export/import + a bootstrap-recovery runbook. Files
under `server/src/modules/recovery/`:

- `recovery.model.ts` — `SelfBackupRun` schema (`repo`, `status`, `snapshotId`,
  `startedAt`, `finishedAt`, `error`). One row per self-backup pass.
- `recovery.schema.ts` — zod `importEnvelopeSchema` (`.strict()` at every
  level, refuses unknown fields), `encryptedSecretSchema`, plus
  `plaintextGuard(input)` — a last-line-of-defence walker that refuses any
  string field named like a plaintext secret (`password`, `secret`, `token`,
  `apiKey`, `sshKey`, `privateKey`) unless it's inside a well-formed
  `EncryptedSecret` shape.
- `recovery.export.ts` — `buildExportEnvelope(userId)`. Iterates the caller's
  `Project` docs and copies each `repoPasswordEnc` **verbatim** — never calls
  `decryptSecret`. Storage connection (host, user, optional `sshKeyEnc`) is
  looked up via an injectable `loadStorage` hook.
- `recovery.import.ts` — `importEnvelope(userId, raw, deps)`. Validates via
  `importEnvelopeSchema`, runs `plaintextGuard`, and probes every ciphertext
  with `decryptSecret` (a tampered ciphertext → GCM auth fails → 400; unknown
  `keyVersion` → 400). Reconciles by `(owner, id)` — idempotent, never
  duplicates. A referenced id already owned by another user → 403.
- `recovery.selfbackup.ts` — `runSelfBackup({ resticRunner, mongoDump })`.
  Streams `mongodump --archive --oplog` directly into
  `restic backup --stdin --stdin-filename dockstash-mongo.archive` against
  the reserved `SELF_BACKUP_REPO`. Never writes a temp file. Persists a
  `SelfBackupRun` row (`running` → `success` on write, `running` → `failed`
  atomically on any failure — no partial). Also exports
  `enqueueSelfBackup({ queue })` (adds one serialized job against the
  reserved repo id via the prompt-05 per-repo queue) and
  `registerSelfBackupCron({ cron, cronExpr, enqueue })` (idempotent
  `cron.register` next to the other scheduler jobs).
- `recovery.controller.ts` + `recovery.routes.ts` — `POST /api/recovery/export`
  (returns the envelope as `Content-Disposition: attachment`),
  `POST /api/recovery/import` (accepts `{ envelope }` or the raw envelope),
  `POST /api/recovery/self-backup` (triggers a run for testing),
  `GET /api/recovery/self-backup` (lists recent runs). All routes behind
  `requireAuth`.

### `SelfBackupRun` collection

| Field | Type | Notes |
|-------|------|-------|
| `repo` | `string` | Reserved repo id (`SELF_BACKUP_REPO`). Indexed. |
| `status` | `'running' \| 'success' \| 'failed'` | No partial success. |
| `snapshotId` | `string` | Optional. |
| `startedAt` | `Date` | Required. |
| `finishedAt` | `Date \| null` | Stamped on transition out of `running`. |
| `error` | `string` | Localized failure message. |

### Export envelope shape (`version: 1`)

```json
{
  "version": 1,
  "exportedAt": "2026-07-01T03:00:00.000Z",
  "keyVersion": 1,
  "projects": [
    {
      "id": "…ObjectId…",
      "name": "acme",
      "path": "/var/www/acme",
      "plan": { "paths": ["…"], "databases": [], "configs": ["…"] },
      "repoPasswordEnc": {
        "ciphertext": "…base64…",
        "iv": "…base64…",
        "authTag": "…base64…",
        "keyVersion": 1
      }
    }
  ],
  "storage": {
    "host": "storage.example.com",
    "user": "restic",
    "sshKeyEnc": { "ciphertext": "…", "iv": "…", "authTag": "…", "keyVersion": 1 }
  }
}
```

Plaintext secrets never appear in the envelope. The envelope is safe to
store off-box only because every secret is useless without the running
agent's `MASTER_ENCRYPTION_KEY`. See `docs/bootstrap-recovery.*.md` for the
full "production VPS is gone" runbook.

### Env vars

- `SELF_BACKUP_REPO` — reserved repo identifier for self-backup, default
  `dockstash-self`. Must never collide with a user project id.
- `SELF_BACKUP_CRON` — self-backup cadence, default nightly `0 3 * * *`.

## Client dashboard

The authenticated shell renders four screens plus a one-time setup wizard.

### Feature modules

| Module | Files | Purpose |
|---|---|---|
| `client/src/features/projects/` | RTK slice + `ProjectsScreen`, `ProjectDetailScreen` | Auto-scanned `/var/www/*` project cards, plan Switch toggles, schedule form with cron validation, drill status. |
| `client/src/features/snapshots/` | RTK slice + `SnapshotsScreen`, `RestoreDialog` | Timeline table, typed-confirm restore (project-name exact match, overwrite is explicit opt-in). |
| `client/src/features/settings/` | RTK slice + `SettingsScreen`, `SetupWizard` | Storage / retention / encryption-password tabs (persisted via `?tab=`); wizard shows the encryption password once and gates *Done* behind an escrow checkbox. |

Reducers are registered in `client/src/app/store.ts`; routes are spread into
`client/src/app/routes.tsx`. Routes are auth-gated by `<RequireAuth>` from the
auth feature.

### Shared additions

- `client/src/shared/hooks/useTabParam.ts` — reads/writes the `?tab=` query
  parameter with a default and validated-value fallback, `replace: true` on
  every switch.
- `client/src/shared/socket/logStream.ts` — Socket.IO client wrapper for the
  `/scheduler` namespace (JWT auth, `join`/`log`/`done`/`failed` events).
- `client/src/shared/components/ResticLogPanel.tsx` — a live-log surface driven
  by that socket wrapper; `role="log"` + `aria-live="polite"`.

### i18n

Five new namespaces (`projects`, `projectDetail`, `snapshots`, `settings`,
`wizard`) with identical key sets and interpolation placeholders across all
seven locales (en, ar, fr, de, es, ru, zh). The prompt-01 parity test in
`shared/i18n/i18n.test.tsx` covers every namespace automatically.
