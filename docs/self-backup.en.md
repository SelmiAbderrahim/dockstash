# Self-backup

The orchestrator backs up **its own** Mongo — projects, schedules, encrypted
secrets, backup history — to the storage VPS as a dedicated restic repo
distinct from every user project's repo.

## What is captured

- `Project` docs (paths, plan, encrypted repo passwords).
- `Schedule` docs (cron, retention, kind).
- Encrypted secrets (Polar token, storage SSH key, restic repo passwords) —
  as ciphertext, never plaintext.
- Backup / verify / drill history rows.

The orchestrator streams `mongodump --archive --oplog` directly into
`restic backup --stdin` — no temp file is ever written. `--oplog` guarantees
point-in-time consistency across all collections.

## The reserved repo

Self-backup writes to `SELF_BACKUP_REPO` (default `dockstash-self`) — a
reserved identifier that never collides with a user project. The
per-project BullMQ queue (prompt 05) serializes concurrent cron ticks
against this repo so restic never sees two concurrent operations against the
same repository.

## Schedule

Cadence is `SELF_BACKUP_CRON` (default nightly at `0 3 * * *`), registered
next to the other cron jobs. Re-registration on boot is idempotent — the
cron entry is replaced in place, never stacked.

## Failure semantics

Every run persists a `SelfBackupRun` row: `running` → `success` on write, or
`running` → `failed` if any layer fails. There is no partial `success`. If
`mongodump` fails, `restic backup` is never invoked. If `restic backup`
fails, the archive stream is destroyed. The failure is stored on the row
along with the error message.
