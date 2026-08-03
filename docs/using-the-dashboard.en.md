# Using the dashboard

Dockstash gives you four screens and a one-time setup wizard. Each screen has one primary action.

## Setup wizard (first run)

1. **Storage VPS** — paste the host, user, port, and SSH private key of the machine where restic repositories will live.
2. **Encryption password** — a strong password is generated and shown **once**. Copy it to a password manager immediately.
3. **Confirm** — tick "I saved it — losing this means the repos are unrecoverable" to enable **Done**. The password is not displayed again.

If you lose the encryption password, your repositories cannot be decrypted — Dockstash cannot recover them.

## Projects

Each folder under `/var/www` is auto-detected as a project. Every card shows the last backup time, size, and a status badge. One primary action: **Backup Now**. Live restic output streams in a log panel below the card while the job runs.

## Project detail

Three tabs (URL-persisted via `?tab=`):

- **Plan** — toggle Files, Databases, and Traefik config on or off. Primary action: **Save plan**.
- **Schedule** — pick daily / weekly / custom cron. Cron expressions are validated inline. Primary action: **Save schedule**.
- **Restore drill** — shows the timestamp and pass/fail badge of the last restore drill (from `lastDrillAt`). "Verified" is a real drill; missing or "Failed" means the backup has not been proven restorable.

## Snapshots

Pick a project, browse the timeline of restore points, click **Restore** on any row. A typed-confirm dialog appears: you must type the exact project name and choose a mode:

- **Restore to new location** (default, safe) — you enter a target path
- **Overwrite existing** (explicit opt-in) — dangerous

Restic output streams in a log panel below the table.

## Settings

Three tabs (URL-persisted via `?tab=`):

- **Storage** — host, user, port, private key (write-only; never displayed again after save).
- **Retention** — keep N daily / weekly / monthly snapshots.
- **Encryption password** — rotate the repo password. Requires ticking "I have saved this password somewhere safe" before **Save** is enabled.
