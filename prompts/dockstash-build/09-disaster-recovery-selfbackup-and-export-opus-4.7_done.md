# Disaster Recovery — Self-Backup & Config Export/Import — Build Prompt

> **Who backs up the backup tool?** — schedule the orchestrator's OWN Mongo
> (projects, schedules, encrypted secrets, history) to the storage VPS as its own
> restic repo, and ship a one-command **config export/import** so a fresh agent on
> a brand-new production VPS can re-attach to existing storage repos. Secrets stay
> AES-256-GCM ciphertext at every step — **never** plaintext — and a
> bootstrap-recovery runbook documents standing the tool back up from nothing but
> the storage VPS, the master key, and the recovery codes.

---

## Agent

`backend-dev` (primary — owns the new `server/src/modules/recovery/` module, the
self-backup job that reuses the restic orchestration + BullMQ queue from prompts
`03`/`05`, and the export/import service). Coordinate with `typescript-pro` for
the typed export envelope (`ExportEnvelope`, `keyVersion`) and `InferSchemaType`
model exports.

This is build-phase 6 in `IDEA.md` ("DR: orchestrator-Mongo self-backup + config
export/import + bootstrap-recovery doc"). It depends on prompts `00` (Docker
stack), `01` (i18n), `02` (`server/src/shared/crypto/` AES-256-GCM
`encryptSecret`/`decryptSecret` + `keyVersion`, `MASTER_ENCRYPTION_KEY` in
`config/env.ts`), `03` (`modules/backups/` — `Project` model, injectable
`ResticRunner`/`SshTransport`), and `05` (BullMQ serialized per-repo queue +
scheduler). Do not re-add anything those prompts deliver.

## Mission

`IDEA.md` §6 "Disaster recovery of the tool itself" defines three deliverables.
Build the module that makes all of them real:

1. **Self-backup** — the orchestrator's own Mongo (projects, schedules, encrypted
   secrets, backup history) is dumped (`mongodump --oplog`) and pushed to the
   storage VPS as its **own dedicated restic repo**, on a schedule, serialized
   through the same one-job-per-repo BullMQ queue from prompt `05`.
2. **Config export/import** — `POST /api/recovery/export` produces a single
   portable envelope of repo definitions + encrypted secrets (ciphertext +
   `keyVersion`, never plaintext); `POST /api/recovery/import` validates and
   reconnects a fresh agent to the existing storage repos.
3. **Bootstrap-recovery runbook** — exact, ordered steps to recover from
   "production VPS is gone", assuming only the storage VPS + the master key +
   the recovery codes survive.

## Operating Constraints

| Rule | Detail |
|---|---|
| Never export plaintext secrets | The export envelope carries **only** AES-256-GCM ciphertext + `keyVersion` for every secret (restic repo password, storage SSH key), exactly as stored. Re-use `encryptSecret`/`decryptSecret` (`server/src/shared/crypto/`, prompt `02`). No `decryptSecret` call anywhere in the export path. A test asserts no plaintext secret byte appears in the envelope. |
| Master key required to use the export | The envelope is safe to store off-box because the secrets are useless without `MASTER_ENCRYPTION_KEY`. Document this explicitly in the wizard/runbook; the envelope itself contains no key material. |
| Self-backup is its own repo | The orchestrator Mongo dump goes to a **separate, reserved restic repo** on the storage VPS (e.g. `dockstash-self`), never mixed with a user project's repo. Serialize it through the prompt `05` BullMQ queue (one job per repo) — concurrent restic ops corrupt a repo (`IDEA.md` §6). |
| Reuse, don't fork | Self-backup uses the prompt `03` `ResticRunner`/`SshTransport` boundaries and the prompt `05` queue + scheduler. The Mongo dump uses the same `mongodump --oplog` consistency rule. Do not add a second restic runner or a second queue. |
| Stream, don't spool | Prefer `mongodump --archive` streamed into `restic backup --stdin` (disk-space safety, `IDEA.md` §6). Out-of-space mid-dump fails cleanly, marked `failed`. |
| keyVersion integrity | Import rejects an envelope whose `keyVersion` does not match a key the running agent can decrypt with; a tampered/garbled ciphertext fails GCM auth and is rejected with a localized `HttpError.badRequest`. |
| Ownership + auth | Every recovery route sits behind `requireAuth` (`shared/middleware/require-auth.ts`); export/import are scoped to the calling `userId`; cross-user project refs throw `HttpError.forbidden()` (`shared/utils/http-error.ts`). |
| Env from root only | Any new var (e.g. self-backup repo name/schedule) flows through `server/src/config/env.ts` zod schema + `.env.example`. No subdirectory `.env`. |
| Named exports + typed schemas | No `export default`; new models use `InferSchemaType` + named export (`mern-no-default-exports.md`, `mern-mongoose-typed-schemas.md`). |
| Excluded | No automatic cross-region replication, no envelope cloud upload, no UI for editing an envelope by hand. Export/import is file-in/file-out plus the runbook. |

## Phases

### Phase 0 — Map the model
- 0.1 Read `server/src/modules/backups/` end-to-end (prompt `03`): the `Project`
  model + `plan` subdoc shape, `backups.boundaries.ts` (`ResticRunner`,
  `SshTransport`), and the encrypted `repoPasswordEnc` field — the export must
  round-trip exactly these.
- 0.2 Read the prompt `05` queue/scheduler (`server/src/modules/scheduler/` or the
  BullMQ wrapper it introduced): how a per-repo job is enqueued serialized, and
  how `node-cron` triggers register jobs. Self-backup enqueues the same way.
- 0.3 Read `server/src/shared/crypto/` (prompt `02`): `encryptSecret`,
  `decryptSecret`, the stored blob shape (`{ ciphertext, iv, authTag,
  keyVersion }` or equivalent) — the envelope reuses this verbatim.
- 0.4 Read `server/src/config/env.ts` (`MASTER_ENCRYPTION_KEY`, storage host),
  `server/src/shared/utils/http-error.ts`, `async-handler.ts`, the i18n
  `t(key, vars)` + `req.language` helper (prompt `01`), and `server/src/app.ts`
  `createApp()` mount pattern.
- 0.5 Confirm no `modules/recovery/` exists yet; decide the reserved self-backup
  repo identifier and whether it lives in env or a constant.

### Phase 1 — Schema & model
New `server/src/modules/recovery/`:
- 1.1 `recovery.model.ts` — `SelfBackupRun` Mongoose schema, `{ timestamps: true }`:
  `repo` (the reserved self-backup repo id), `status`
  (`enum: ['running','success','failed']`), `snapshotId`, `sizeBytes`,
  `startedAt`, `finishedAt`, `error`. Export `SelfBackupRun` +
  `type SelfBackupRunDocument = InferSchemaType<typeof selfBackupRunSchema>`.
- 1.2 `recovery.schema.ts` — zod: `importEnvelopeSchema` validating the envelope
  shape (`version`, `exportedAt`, `projects[]` with `plan`, per-secret
  `{ ciphertext, iv, authTag, keyVersion }`, `storage` connection ref). Reject
  any field shaped like a plaintext secret (e.g. a `password` string not under
  the ciphertext envelope) — fail closed.

### Phase 2 — Export/import service (pure over injected boundaries)
New `recovery.export.ts` + `recovery.import.ts`:
- 2.1 `buildExportEnvelope(userId)` → typed `ExportEnvelope`: iterate the user's
  `Project` docs, serialize each `plan` (paths/databases/configs) and the storage
  connection, and copy each encrypted secret **as stored** (ciphertext +
  `keyVersion`) — **no `decryptSecret`**. Stamp `version`, `exportedAt`,
  `keyVersion` summary. Return a JSON-serializable object (the controller writes it
  as a download).
- 2.2 `importEnvelope(userId, envelope)`: validate via `importEnvelopeSchema`;
  reject if any secret's `keyVersion` cannot be decrypted by the running agent
  (call `decryptSecret` on a probe to confirm GCM auth succeeds — a tampered or
  wrong-key envelope throws and is surfaced as `HttpError.badRequest`); reconstruct
  `Project` docs (own them to `userId`), re-store the ciphertext verbatim, and
  reconnect to the storage repos via the prompt `03` `SshTransport`/`ResticRunner`
  (e.g. `restic snapshots` to confirm the repo is reachable with the decrypted
  password). Idempotent: re-importing the same envelope reconciles, never
  duplicates a project.

### Phase 3 — Self-backup job
New `recovery.selfbackup.ts`:
- 3.1 `runSelfBackup()`: stream `mongodump --archive --oplog` of the orchestrator
  DB into `resticRunner.backup(['backup','--stdin','--stdin-filename',
  'dockstash-mongo.archive'])` against the reserved self-backup repo, enqueued
  **serialized** through the prompt `05` BullMQ per-repo queue. Persist a
  `SelfBackupRun`; any failure → `status: 'failed'`, never partial.
- 3.2 Register the schedule beside the other cron jobs from prompt `05` (do not
  create a second scheduler). Default cadence configurable via env; document it.
- 3.3 Ensure the self-backup repo is initialized (`restic init`) once if absent,
  and that a stale lock is `restic unlock`-recovered before retry (reuse the
  prompt `05` stale-lock recovery; do not reimplement).

### Phase 4 — Controller, routes & wiring
- 4.1 `recovery.controller.ts` — thin handlers (zod parse → service → JSON),
  each wrapped in `asyncHandler`. `export` returns the envelope with
  `Content-Disposition: attachment` (filename includes `exportedAt`); `import`
  takes the uploaded envelope; `selfBackup` triggers an immediate run for testing;
  `selfBackupStatus` lists recent `SelfBackupRun`s.
- 4.2 `recovery.routes.ts` — `express.Router()` with `requireAuth`:
  `POST /export`, `POST /import`, `POST /self-backup`, `GET /self-backup`.
  `index.ts` — named re-exports (`recoveryRouter`, `SelfBackupRun`,
  `buildExportEnvelope`, `importEnvelope`, `runSelfBackup`).
- 4.3 Mount in `server/src/app.ts` `createApp()`:
  `app.use('/api/recovery', recoveryRouter)` (behind `requireAuth`). Add any new
  env var to `config/env.ts` + `.env.example` (root only).

### Tests
Server (`server/`, vitest node, `fileParallelism:false`, v8 coverage **100% gate**
on statements/branches/functions/lines; supertest against `createApp()`;
`startMemoryMongo`/`stopMemoryMongo`/`clearCollections` from
`server/src/shared/testing/mongo.ts`). All boundaries (`ResticRunner`,
`SshTransport`, queue, `mongodump`) injected as mocks — no real restic/Mongo dump.
`server/src/modules/recovery/recovery.test.ts`:
- **Self-backup enqueues to its own repo:** `runSelfBackup` enqueues a single,
  **serialized** job against the reserved self-backup repo (never a user repo);
  assert the mock queue received one job for that repo and that a concurrent call
  does not run two restic ops on it.
- **Export round-trip:** `buildExportEnvelope` → `importEnvelope` reconstructs the
  project definitions exactly (paths/databases/configs), and the secrets remain
  the **same ciphertext** (assert byte-equal `ciphertext`/`keyVersion`); a
  decrypt with the correct `MASTER_ENCRYPTION_KEY` after import yields the original
  password.
- **No plaintext ever in the export:** seed a project with a known repo password,
  export, and assert the plaintext password string is **absent** from the
  serialized envelope (search the JSON bytes); assert `decryptSecret` is never
  called in the export path (spy).
- **Import rejects tampered/wrong-key envelope:** flip a byte of a ciphertext →
  GCM auth fails → `HttpError.badRequest`; an envelope with an unknown
  `keyVersion` the agent can't decrypt → rejected; a `password`-shaped plaintext
  field → zod-rejected (fail closed).
- **Ownership:** importing an envelope whose projects reference another user, or
  exporting another user's projects, is scoped/`forbidden` — no cross-user leak.
- **Atomicity:** a failing `mongodump` or restic layer → `SelfBackupRun` persisted
  `failed`, never partial; stream path asserted (no temp file written).
- **Idempotency:** re-importing the same envelope reconciles in place (no duplicate
  `Project`); a second `runSelfBackup` registration does not add a second cron job.

### i18n
All user-facing recovery errors/success messages localized via the prompt-`01`
server `t(key, vars)` helper in the caller's `req.language`. Locales: **en, ar,
fr, de, es, ru, zh** (7), auto-detected from `Accept-Language`; **ar is RTL**.
Keys e.g. `recovery.error.importTampered`, `recovery.error.keyVersionMismatch`,
`recovery.error.selfBackupFailed`, `recovery.success.exportReady`,
`recovery.success.imported`. Add a key-parity test asserting all 7 locale
dictionaries expose identical keys + placeholder vars. No hardcoded user-facing
strings.

### Documentation
- `/docs` page **"Bootstrap recovery"** — the exact ordered runbook to recover
  from "production VPS is gone": (1) stand up a fresh agent (compose up, prompt
  `00`), (2) supply the **same** `MASTER_ENCRYPTION_KEY` (Docker secret), (3)
  import the saved export envelope, (4) the agent decrypts the storage SSH key +
  repo passwords and `restic snapshots` confirms the repos are reachable, (5)
  restore. State plainly: **without the master key + recovery codes, the export is
  inert and the repos are unrecoverable.** Authored in all 7 languages (user-facing).
- `/docs` page "Self-backup" — what is captured (the orchestrator Mongo: projects,
  schedules, encrypted secrets, history), the reserved repo, the schedule.
- `ARCHITECTURE.md`: the `recovery` module, the `SelfBackupRun` table, the export
  envelope shape, the self-backup job. `.env.example`: any new var, documented.

## Agents & Skills

- **Agents:** `backend-dev` (module, export/import, self-backup job);
  `typescript-pro` (the `ExportEnvelope`/`keyVersion` typing + `InferSchemaType`).
- **Skills:** `spec-driven-development` (spec → plan → tasks before code, per
  `.claude/rules/spec-driven-development.md`); `docker-workflow-automation`
  (mongodump-in-container + restic-stdin orchestration, the fresh-agent bootstrap);
  `verify` (export → import round-trip + a mocked self-backup end-to-end);
  `code-review` (final pass — assert no `decryptSecret` in the export path, no
  plaintext secret in the envelope).

## Idempotency Contract

Re-running MUST NOT: create a second `modules/recovery/` or duplicate the
`SelfBackupRun` model/index, re-mount `/api/recovery` twice in `app.ts`, register
a second self-backup cron job or a second queue, re-add env vars already present in
`config/env.ts`/`.env.example`, or stack `requireAuth` twice on the router.
Re-importing an envelope reconciles existing projects in place rather than
duplicating them. Detect existing files, jobs, and mounts and converge to the same
final state on every run.
