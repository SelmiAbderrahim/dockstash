# Backup Verification — `restic check` & Automated Restore Drill — Build Prompt

> **A backup is unproven until it restores.** Add scheduled `restic check` per
> repo, an automated restore drill that restores the latest snapshot to a scratch
> location and diffs it against source, a failure-injection harness, and a
> real-`restic` integration test — so the system never reports a false "success".

---

## Agent

`tester` (primary — owns the verification correctness surface: restore round-trip
diff, the failure-injection matrix, the real-restic integration test, and the
drill-status persistence assertions). Coordinate with `backend-dev` (the
`backups` module from prompt 03 — drill service, model fields, schedule wiring).

This is `IDEA.md` §6 "Backup verification" + §2 "Beyond coverage — correctness
tests". It builds **directly on prompt 03** (the `backups` module, the injectable
`ResticRunner`/`DockerClient` boundaries, the `Project` model). Reuse them; do not
re-create the module.

## Mission

100% coverage ≠ correct. This feature proves backups are real:

1. **Scheduled `restic check`** per repo (structure integrity; optional
   `--read-data-subset=<pct>` for data integrity), registered exactly once.
2. **Automated restore drill** — restore the latest snapshot to a scratch path and
   **diff against source**: row-diff for databases, byte-diff for files. A green
   drill is the only proof a backup restores.
3. **Drill status in the model** — `lastDrillAt`, `lastDrillStatus` (pass/fail),
   `lastDrillDetail`, surfaced per project for the UI.
4. **Failure-injection harness** — kill mid-backup, fill disk, drop network, and
   present a stale restic lock; assert the orchestrator fails safe and reports the
   correct status, never a false green.
5. **Real-restic integration test** — run against an actual `restic` binary in a
   throwaway container so command construction, locking, and exit codes are
   exercised (not just mocks).

## Operating Constraints

| Rule | Detail |
|---|---|
| Cardinal test = restore round-trip | seed data → backup → restore to a scratch location → byte/row-diff original vs restored. Anything that can't restore is a failure, regardless of exit code (`IDEA.md` §2). |
| Real restic, not only mocks | At least one integration test runs an actual `restic` binary in a throwaway container; assert command construction, locking, exit codes for real (`IDEA.md` §2). Unit tests still use the injectable `ResticRunner`/`DockerClient` mocks from prompt 03. |
| Never a false success | Every failure-injection scenario must end in `failed`/`drill-fail` status — never `success`. Assert the negative explicitly (`IDEA.md` §6). |
| Restore through the boundary | Restore + drill go through the injectable `ResticRunner`/`DockerClient` interfaces (prompt 03 `backups.boundaries.ts`) so the same code path is unit-testable and integration-testable. |
| DB drill = row-diff | Database drills restore the dump into a scratch DB (or parse the dump) and **row-diff** against source; file drills **byte-diff** (hash compare). Per-adapter torn-write detection (`IDEA.md` §6). |
| Scratch isolation | Drills restore to an isolated scratch path / scratch container — never overwrite the live project. Scratch is cleaned up even on failure. |
| Scheduled once | `restic check` + drill schedules registered through the cron/queue layer (prompt 05) exactly once per repo; re-run does not stack duplicates. |
| Localized status | Drill/check failure messages localized via the prompt-01 `t(key, vars)` helper; surfaced status fields drive the UI. |
| Named exports + typed schemas | No `export default`; model additions keep `InferSchemaType` typing (repo rules). |

## Phases

### Phase 0 — Map the model
- 0.1 Read prompt 03's output in `server/src/modules/backups/`:
  `backups.boundaries.ts` (`ResticRunner`, `DockerClient`, `SshTransport`),
  `backups.service.ts` (`runBackup` orchestration + atomicity), `backups.model.ts`
  (`Project`, `lastStatus`), and the adapter registry (`dumpCmd`/`restoreCmd`).
- 0.2 Read `server/src/shared/testing/mongo.ts`
  (`startMemoryMongo`/`stopMemoryMongo`/`clearCollections`),
  `server/src/shared/utils/http-error.ts`, `server/src/shared/utils/async-handler.ts`,
  and the i18n `t(key, vars)` + `req.language` helper (prompt 01).
- 0.3 Confirm a `restic` binary is available in the test container image (from
  prompt 00's Docker stack); decide how the integration test spins a throwaway
  local repo (a temp dir restic repo over the local backend is sufficient).

### Phase 1 — Model: drill & check status
Extend `server/src/modules/backups/backups.model.ts` `Project`:
- 1.1 Add `lastCheckAt` (string|null), `lastCheckStatus`
  (`enum ['pass','fail',null]`), `lastDrillAt`, `lastDrillStatus`
  (`enum ['pass','fail',null]`), `lastDrillDetail` (string — localized summary or
  diff count). Keep `{ timestamps: true }`; keep `InferSchemaType` export.
- 1.2 Extend `backups.schema.ts` with `runDrillSchema` / `runCheckSchema`
  (`{ projectId }`, optional `readDataSubset` pct 1–100).

### Phase 2 — Verification service
New `server/src/modules/backups/backups.verify.service.ts`:
- 2.1 `runResticCheck(projectId, userId, { readDataSubset? })` →
  `resticRunner` `['check']` (+ `['--read-data-subset', '<pct>%']` when given);
  parse exit code/output → persist `lastCheckAt` + `lastCheckStatus`. Own-check
  the project (`HttpError.forbidden`).
- 2.2 `runRestoreDrill(projectId, userId)`:
  - resolve latest snapshot via `resticRunner.snapshots`;
  - restore to an isolated scratch path (`resticRunner` `['restore','latest',
    '--target', scratch]`);
  - for each file path layer: **byte/hash-diff** scratch vs source → mismatch
    count;
  - for each DB layer: restore the dump into a scratch DB via `dockerClient.exec`
    with the adapter `restoreCmd` (arg array) and **row-diff** scratch vs source;
  - aggregate → `pass` only if zero mismatches; persist `lastDrillAt`,
    `lastDrillStatus`, localized `lastDrillDetail`; always clean up scratch
    (try/finally), even on throw.
- 2.3 `runScheduledChecks()` / `runScheduledDrills()` — iterate projects, run per
  repo, one failing project must not abort the loop (log + continue).

### Phase 3 — Failure-injection harness (the heart of this prompt)
`server/src/modules/backups/backups.failure.test.ts` — drive `runBackup`/
`runRestoreDrill` with mock boundaries configured to inject each fault:
- 3.1 **Kill mid-backup** — `DockerClient.exec` stream errors partway → assert
  snapshot `failed`, no partial-success, scratch cleaned.
- 3.2 **Fill disk** — `ResticRunner.backup` rejects with `ENOSPC` → assert clean
  `failed`, surfaced disk-space error, no false green.
- 3.3 **Drop network** — `ResticRunner` rejects with a connection error → `failed`.
- 3.4 **Stale lock present** — `ResticRunner` first rejects with a "repository is
  already locked" error → assert the orchestrator does NOT silently report success
  (recovery/unlock itself is owned by prompt 05; here, assert fail-safe status +
  the correct error surfaced, never `success`).
- 3.5 **Torn dump** — adapter dump returns truncated/inconsistent data → drill
  row-diff detects the mismatch → `drill-fail`.

### Phase 4 — Real-restic integration test
`server/src/modules/backups/backups.restic-integration.test.ts` (gated to run
where the `restic` binary exists — prompt 00's image):
- 4.1 Init a throwaway repo in a temp dir; seed a known file tree + a small DB
  dump fixture.
- 4.2 Run the real orchestration (real `ResticRunner` impl, real `restic backup`)
  → run `runRestoreDrill` → assert the **round-trip byte/row-diff is clean**.
- 4.3 Assert real exit codes / locking behavior: a concurrent op against the
  locked repo surfaces the lock error; `restic check` passes on the fresh repo.
- 4.4 Tear down the temp repo in `afterAll`.

### Phase 5 — Routes & wiring
- 5.1 `backups.verify.controller.ts` — `POST /:id/check`, `POST /:id/drill`
  handlers (zod parse → service → JSON), wrapped in `asyncHandler`, behind
  `requireAuth`, own-checked. Add to `backups.routes.ts`; re-export from
  `index.ts` (named).
- 5.2 Schedule registration (`restic check` + drill cadence) is handed to the
  cron/queue layer in **prompt 05** — expose `runScheduledChecks` /
  `runScheduledDrills` as the entry points it will call. Document the handoff;
  do not register cron here.

### Tests
This prompt **is** largely about tests (server, vitest node,
`fileParallelism:false`, v8 **100% gate**; `startMemoryMongo`; supertest against
`createApp()`; injectable boundary mocks from prompt 03). In addition to the
Phase 3 failure matrix and the Phase 4 real-restic test:
- **Restore round-trip diff (cardinal):** seed → backup → restore to scratch →
  byte-diff files + row-diff DB → assert clean `pass`; mutate one byte/row →
  assert `fail` with the correct mismatch count.
- **Drill status persisted:** `lastDrillAt`/`lastDrillStatus`/`lastDrillDetail`
  written for both pass and fail; surfaced in `GET /:id`.
- **Check status persisted:** pass and fail paths both stamp `lastCheckStatus`;
  `--read-data-subset` arg array asserted when pct supplied.
- **Per-adapter torn-write:** each DB type's drill detects an inconsistent dump.
- **Schedule entry points:** `runScheduledChecks`/`runScheduledDrills` continue
  past a throwing project (second project still processed).
- **Ownership:** cross-user `check`/`drill` → `403`.
- **Scratch cleanup:** scratch path/container removed on both success and throw.
- Edge cases: no snapshots yet (drill returns a clear "nothing to restore" status,
  not a crash); empty repo `check`.

### i18n
Drill/check failure + success messages localized via the prompt-01 `t(key, vars)`
helper in `req.language`. Locales: **en, ar, fr, de, es, ru, zh** (7) with
auto-detect (`Accept-Language` / `navigator.language`); **ar RTL**. Keys e.g.
`backups.drill.pass`, `backups.drill.fail`, `backups.check.fail`,
`backups.drill.nothingToRestore`. `lastDrillDetail` is rendered localized. Add a
key-parity test (all 7 dictionaries, identical keys + placeholder vars). No
hardcoded user-facing strings.

### Documentation
- `/docs` page "Backup verification" (what `restic check` proves vs what the
  restore drill proves, why a green drill is the real guarantee, how often they
  run) — authored in all 7 languages where user-facing.
- `ARCHITECTURE.md`: the verification service, drill round-trip diff, the new
  `Project` drill/check fields, and the failure-injection + real-restic test
  strategy.

## Agents & Skills

- **Agents:** `tester` (correctness tests, failure-injection matrix, real-restic
  integration, drill-status assertions); `backend-dev` (drill/check service, model
  fields, routes, schedule entry points).
- **Skills:** `comprehensive-testing-strategy` / `enterprise-testing-framework`
  (coverage gate, layered test design, fixtures); `verify` (run a real
  seed→backup→drill round-trip and confirm the diff); `docker-workflow-automation`
  (throwaway restic container for the integration test); `code-review` (assert no
  scenario can end in a false `success`).

## Idempotency Contract

Re-running MUST NOT: duplicate the `Project` drill/check fields, re-add the
`/:id/check` or `/:id/drill` routes, re-register schedule entry points, duplicate
the verification service, or create a second failure-injection/integration test
file. Detect prompt-03 boundaries + model and extend them in place. The schedule
registration belongs to prompt 05 — never register a cron job here.
