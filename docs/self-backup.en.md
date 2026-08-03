# Self-backup

The orchestrator backs up **its own** Mongo — projects, schedules, encrypted
secrets, backup history — to a dedicated restic repository distinct from
every user project's repo. Compose stores it in the durable
`self-backup-data` volume by default.

## What is captured

- `Project` docs (paths, plan, encrypted repo passwords).
- `Schedule` docs (cron, retention, kind).
- Encrypted secrets (storage SSH key, restic repo passwords) —
  as ciphertext, never plaintext.
- Backup / verify / drill history rows.

The orchestrator streams `mongodump --archive` directly into
`restic backup --stdin` — no temp file is ever written. The bundled Mongo is
standalone, so the dump does not claim cross-collection point-in-time
consistency while writes are active.

## The reserved repo

Self-backup writes to `SELF_BACKUP_REPO` (Compose default `/self-backup`).
The named volume survives container recreation but remains on the same Docker
host. For off-host protection, set this to a remote restic backend URL and
provide that backend's standard restic credentials. Overlapping manual and
scheduled runs are coalesced into one operation.

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
