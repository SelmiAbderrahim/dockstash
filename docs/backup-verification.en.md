# Backup verification

A backup is unproven until it restores. Dockstash proves it two ways:

## `restic check` — structure integrity

Runs `restic check` against the repo. Detects missing pack files, corrupted
index entries, and blob-reference drift — the structural rot that would make
a restore silently short. When you pass `readDataSubset` (a percent from 1–100),
Dockstash appends `--read-data-subset=<pct>%` so restic actually reads and
verifies pack contents, not just their manifests.

- `POST /api/backups/:id/check` on demand.
- Scheduled by the queue layer via `runScheduledChecks`.
- Persists `lastCheckAt`, `lastCheckStatus` (`pass` / `fail`), and a localized
  `lastCheckDetail`.
- `pass` requires a zero exit code — every non-zero exit is `fail`, never a
  false green.

## Restore drill — the real guarantee

`restic check` proves the repo *is well-formed*. Only a restore proves the repo
*restores*. `runRestoreDrill`:

1. Reads the latest snapshot.
2. Restores it into an isolated scratch workspace (never overwriting the live
   project).
3. Walks every source path/config and byte-hashes it against the restored
   mirror. Any mismatch is counted.
4. For every enabled database layer, row-diffs (or parses) the restored dump
   against the source. Torn writes and inconsistent dumps surface as mismatches.
5. Aggregates mismatches. `pass` only when the count is zero.
6. Persists `lastDrillAt`, `lastDrillStatus` (`pass` / `fail`), and a localized
   `lastDrillDetail` that includes the mismatch count on failure.
7. Cleans up the scratch workspace in `finally` — even if the drill throws.

Failure modes explicitly proven to fail *safe* (never a false green): killed
mid-backup, `ENOSPC`, dropped network, stale restic lock, torn dump. See
`backups.failure.test.ts`.

## Cadence

- Structure check: cheap; run on every backup and daily.
- Restore drill: expensive; run at least weekly per project. When the drill
  fails, the run alerts and the UI surfaces `lastDrillStatus=fail` next to the
  project.

Scheduling itself is owned by the queue module (prompt 05). The verification
service exposes `runScheduledChecks` / `runScheduledDrills` as its cron entry
points.
