# Scheduler & Queue — BullMQ, node-cron & Live Socket.IO Logs — Build Prompt

> **One job per repo, or restic corrupts the repo.** Serialize every
> backup/prune/check on a repo through a BullMQ queue, trigger schedules with
> node-cron, recover stale restic locks before retry, run retention as its own
> destructive job, and stream restic stdout/stderr live to the UI over the
> existing Socket.IO instance.

---

## Agent

`backend-dev` (primary — owns the new `server/src/modules/scheduler/` module: the
BullMQ queue + worker, node-cron triggers, stale-lock recovery, the `Schedule`
model, and the Socket.IO log-streaming bridge). Builds on prompt 03 (`backups`
module, `runBackup`, injectable `ResticRunner`) and prompt 04
(`runResticCheck`/`runRestoreDrill` entry points).

This is `IDEA.md` build-phase 3 + §6 "Concurrency, locking & retention execution"
+ §5 live logs. Depends on prompts `00` (Docker stack with **redis** + the
retained `io` Socket.IO server), `01` (i18n), `02` (crypto), `03`, `04`.

## Mission

1. **BullMQ queue, one job per repo** — backup / prune / check / drill on a given
   repo are serialized; concurrent restic ops on one repo are impossible.
2. **node-cron triggers** — daily/weekly/cron schedules enqueue jobs; cron parsing
   from a `Schedule` model.
3. **Stale-lock recovery** — detect an orphaned restic lock (crashed run) and
   `restic unlock` safely before retrying.
4. **Retention as its own job** — `forget --prune` runs as a separate serialized
   job, never inside a backup run; map retention policy → forget flags.
5. **Resilience** — job timeouts, stuck-job detection, auto-retry with capped
   backoff, then alert.
6. **Live log streaming** — restic stdout/stderr streamed to the UI over the
   **existing** Socket.IO `io` instance, in a per-job+user room.

## Operating Constraints

| Rule | Detail |
|---|---|
| One job per repo (hard) | Serialize backup/prune/check/drill on a repo via a BullMQ queue keyed so a repo can only run one job at a time (per-repo concurrency = 1 / per-repo lock). Concurrent restic ops on one repo corrupt or deadlock — this is why the queue is required, not optional (`IDEA.md` §6). |
| Prune is its own job | Retention `forget --prune` is destructive, slow, and lock-holding → a separate serialized job, **never** inside a backup run (`IDEA.md` §6). |
| Stale-lock recovery | Before a retry, detect an orphaned restic lock from a crashed run and `restic unlock` safely (not blindly — only when no live job holds the repo). |
| Reuse the existing io | Stream logs over the Socket.IO `io` from `server/src/server.ts` (`new IoServer(server)`) — the chat feature is removed (prompt 00) but the `io` instance is **retained**. Do not create a second Socket.IO server. Namespace/room scoped per `job + user` so a user only sees their own job logs. |
| Argument arrays | restic invocations keep the prompt-03 arg-array discipline (no string-interp shell); the worker calls the injectable `ResticRunner`. |
| Retry caps + backoff | Auto-retry with exponential backoff, a capped attempt count, then mark failed + alert (alert transport is prompt 07; here, leave a hook + emit a failed event). |
| Entitlement hook placeholder | Add an entitlement-check hook before enqueue (e.g. schedule frequency / project cap) — a no-op/allow placeholder now, fully enforced in prompt 07. |
| Mockable | BullMQ queue + `ResticRunner` injected/mocked in unit tests; no real redis/restic required for unit tests (real-restic lives in prompt 04). |
| Named exports + typed schemas | No `export default`; `Schedule` uses `InferSchemaType` + named export (repo rules). |
| Env | `REDIS_URL` (+ timeouts) through `server/src/config/env.ts` zod + `.env.example`. No subdirectory `.env`. |

## Phases

### Phase 0 — Map the model
- 0.1 Read `server/src/server.ts` — confirm the retained `io` instance
  (`new IoServer(server)`) and how it attaches to the HTTP server; this is the
  socket the log bridge reuses.
- 0.2 Read prompt 03 `server/src/modules/backups/`: `backups.service.ts`
  (`runBackup`), `backups.boundaries.ts` (`ResticRunner` — note how it spawns and
  exposes stdout/stderr), and prompt 04 `runResticCheck`/`runRestoreDrill` +
  `runScheduledChecks`/`runScheduledDrills` entry points.
- 0.3 Read `server/src/config/env.ts` (zod env), `server/src/app.ts`
  `createApp()` mount pattern, the i18n `t(key, vars)` helper (prompt 01), and
  `server/src/shared/testing/mongo.ts`.

### Phase 1 — Schema & model
New `server/src/modules/scheduler/`:
- 1.1 `scheduler.model.ts` — Mongoose `Schedule` schema, `{ timestamps: true }`:
  `project` (ObjectId ref `Project`, required, indexed), `owner` (ObjectId ref
  `User`, indexed), `kind` (`enum ['backup','prune','check','drill']`),
  `cron` (string — validated cron expr), `retention` (subdoc:
  `keepDaily/keepWeekly/keepMonthly` numbers, for prune jobs), `enabled` (boolean
  default true), `lastEnqueuedAt`, `lastRunStatus`
  (`enum ['idle','queued','running','success','failed']`). Export `Schedule` +
  `type ScheduleDocument = InferSchemaType<typeof scheduleSchema>` (named).
- 1.2 `scheduler.schema.ts` — zod bodies: `createScheduleSchema`
  (validate `cron` is a parseable expression, `kind` enum, retention numbers ≥ 0),
  `updateScheduleSchema`, `enqueueNowSchema` (`{ scheduleId }` or
  `{ projectId, kind }`).

### Phase 2 — Queue & worker (one job per repo)
- 2.1 `scheduler.queue.ts` — BullMQ `Queue` (connection from `REDIS_URL`). Enqueue
  helper sets a job key/group so **a given repo runs at most one job at a time**
  (per-repo group concurrency = 1, or a repo-scoped lock acquired in the worker).
  Job data: `{ projectId, owner, kind, retention? }`.
- 2.2 `scheduler.worker.ts` — BullMQ `Worker` dispatching by `kind`:
  - `backup` → `runBackup` (prompt 03);
  - `check` → `runResticCheck` (prompt 04);
  - `drill` → `runRestoreDrill` (prompt 04);
  - `prune` → `runPrune` (Phase 3).
  Before running: acquire the per-repo lock + **stale-lock recovery** (Phase 4).
  Job options: timeout, `attempts` (capped), exponential `backoff`. On final
  failure: mark `Schedule.lastRunStatus = failed`, emit a `failed` event + call
  the alert hook (placeholder, prompt 07).
- 2.3 Entitlement-check **hook** before enqueue — a `canEnqueue(owner, kind)`
  placeholder returning allow; prompt 07 swaps in the real `plans.ts` check.

### Phase 3 — Retention (separate destructive job)
- 3.1 `scheduler.prune.service.ts` — `runPrune(projectId, retention)`:
  `resticRunner` `['forget', '--prune', '--keep-daily', n, '--keep-weekly', n,
  '--keep-monthly', n]` (arg array). Document the retention-policy → forget-flags
  mapping in `ARCHITECTURE.md`. Never invoked from inside a backup job — only as
  its own `kind:'prune'` job through the same per-repo serialization.

### Phase 4 — Stale-lock recovery
- 4.1 `scheduler.lock.ts` — before running a repo job, check for an orphaned
  restic lock (no live BullMQ job holds this repo). If orphaned → `resticRunner`
  `['unlock']` then proceed; if a live job holds it → wait/serialize (the queue
  already prevents true concurrency). Never `unlock` while a real run is active.

### Phase 5 — node-cron triggers
- 5.1 `scheduler.cron.ts` — on boot, load enabled `Schedule` docs and register a
  node-cron entry per schedule that **enqueues** a job (cron triggers enqueue;
  the queue runs it). Register each cron exactly once; re-deriving on schedule
  create/update/delete reconciles in place. Cancel all cron + close the
  queue/worker on shutdown (mirror existing graceful-shutdown wiring).

### Phase 6 — Live log streaming over Socket.IO
- 6.1 `scheduler.logstream.ts` — bridge the injectable `ResticRunner` stdout/
  stderr line stream to the retained `io` (`server/src/server.ts`). Emit to a room
  scoped `backup-logs:<jobId>` joined only by the job's `owner` (authenticate the
  socket via the JWT, same secret as `requireAuth`; reject sockets that don't own
  the job). Emit `log` lines + a terminal `done`/`failed` event. No cross-user
  leakage.
- 6.2 Client side (brief): `client/src/features/backups/` consumes the
  `VITE_SOCKET_URL` socket, joins its job room, renders streaming lines (the full
  4-screen UI is a later prompt; here ensure the server contract + room scoping).

### Phase 7 — Routes & wiring
- 7.1 `scheduler.controller.ts` — `POST /schedules`, `GET /schedules`,
  `PATCH /schedules/:id`, `DELETE /schedules/:id`, `POST /enqueue` (zod parse →
  service → JSON), `asyncHandler`-wrapped, behind `requireAuth`, own-checked
  (`HttpError.forbidden`). `scheduler.routes.ts` → mount in `app.ts`:
  `app.use('/api/scheduler', schedulerRouter)`. `index.ts` — named re-exports.
- 7.2 Start the worker + cron in `server.ts` boot (after DB connect, beside the
  `io` setup); close them on shutdown. Add `REDIS_URL` to `config/env.ts` +
  `.env.example`.

### Tests
Server (`server/`, vitest node, `fileParallelism:false`, v8 **100% gate**;
`startMemoryMongo`; supertest against `createApp()`). Mock BullMQ
(queue/worker) + the injectable `ResticRunner`; mock the Socket.IO `io` emit.
`server/src/modules/scheduler/scheduler.test.ts`:
- **One job per repo:** enqueue two jobs for the same repo concurrently → assert
  they run sequentially (second waits), while jobs for different repos run in
  parallel.
- **Stale-lock recovery:** orphaned lock present + no live job → `resticRunner`
  receives `['unlock']` before the run; a live-held repo is NOT unlocked.
- **Prune is separate:** a backup job never calls `runPrune`; a `prune` job calls
  `['forget','--prune', ...flags]` with the retention numbers mapped correctly.
- **Retry/backoff caps:** a repeatedly failing job retries up to the cap with
  growing backoff, then marks `failed` + fires the alert hook + emits `failed`.
- **Cron enqueues:** a registered cron trigger enqueues the expected job; invalid
  cron rejected by zod at create.
- **Socket scoping:** restic log lines emit to `backup-logs:<jobId>`; a non-owner
  socket cannot join/receive; `done`/`failed` terminal event emitted.
- **Entitlement hook:** `canEnqueue` placeholder is consulted before enqueue
  (so prompt 07 can deny).
- **Ownership:** cross-user schedule CRUD/enqueue → `403`.
- Edge cases: enqueue for a missing project; disabled schedule does not enqueue;
  shutdown cancels cron + closes queue/worker.

### i18n
Schedule/job errors + success messages localized via the prompt-01 `t(key, vars)`
helper in `req.language`. Locales: **en, ar, fr, de, es, ru, zh** (7) with
auto-detect (`Accept-Language` / `navigator.language`); **ar RTL**. Keys e.g.
`scheduler.error.invalidCron`, `scheduler.error.repoBusy`,
`scheduler.success.scheduled`, `scheduler.job.failedRetriesExhausted`. Streamed
log lines are restic raw output (not translated); surrounding status/UI labels are
localized client-side (i18next). Key-parity test across all 7 dictionaries. No
hardcoded user-facing strings.

### Documentation
- `/docs` page "Schedules & live logs" (schedule kinds, the one-job-per-repo
  guarantee, retention → forget-flag mapping, watching live logs) — authored in
  all 7 languages where user-facing.
- `ARCHITECTURE.md`: the BullMQ queue + worker, per-repo serialization, stale-lock
  recovery, node-cron triggers, the Socket.IO log-room contract, the `Schedule`
  table, and `REDIS_URL`.

## Agents & Skills

- **Agents:** `backend-dev` (queue, worker, cron, lock recovery, log bridge,
  `Schedule` model).
- **Skills:** `docker-workflow-automation` (redis service from compose, restic
  process streaming, container orchestration); `spec-driven-development` (spec the
  concurrency model before coding); `verify` (enqueue a job, watch live logs in a
  job room end-to-end); `code-review` (assert one-job-per-repo + no cross-user
  socket leakage).

## Idempotency Contract

Re-running MUST NOT: create a second BullMQ queue/worker for the same name,
register a node-cron trigger twice for the same schedule, create a second
Socket.IO server (always reuse the retained `io`), duplicate the `Schedule` model
or `/api/scheduler` mount, re-add `REDIS_URL`, or stack `requireAuth` twice.
Reconcile cron registrations against `Schedule` docs in place — exactly one cron
per enabled schedule, one worker, one queue.
