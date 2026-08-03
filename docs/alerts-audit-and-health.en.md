# Alerts, audit & health

Dockstash makes failure loud. Any failed backup, restore, or drill triggers an
immediate email (via Resend) to the project owner. A dead-man's-switch heartbeat
catches silent stalls — the case where nothing errored but nothing ran.

## What triggers an alert

| Kind | When |
|---|---|
| `backup` | A backup run fails at any layer (dump, restic, disk space). |
| `restore` | A restore fails. |
| `drill` | A scheduled restore drill fails (byte diff or DB row diff). |
| `heartbeat` | No successful backup for a project in the past `ALERT_HEARTBEAT_HOURS` hours. |

Every alert email carries the project name, the error, the last-good timestamp,
and a deep link to the project dashboard. When `ALERT_WEBHOOK_URL` is set, the
same payload is POSTed as JSON to that URL — plug it into Slack, PagerDuty, or
your own on-call bot.

## The heartbeat window

`ALERT_HEARTBEAT_HOURS` (default `24`) sets the silent-stall threshold. If a
project's last successful backup is older than this window (or the project has
never succeeded), the heartbeat sweep alerts once — and dedupes for the same
window before re-alerting. A successful backup clears the dedupe stamp
immediately.

## Audit trail

Destructive or billable actions are appended to an immutable audit log:

- `backup.run` — Backup-Now / scheduled backup enqueue
- `backup.restore` — restore drill trigger
- `backup.delete` — schedule delete
- `plan.change` — subscription plan change

Each entry captures the actor, action, target, source IP, and timestamp.
There is no update or delete path on the audit log — entries are append-only.

Fetch your audit trail via `GET /api/audit` (owner-scoped, requires auth).

## Health & metrics endpoints

- `GET /api/health` — unauthenticated readiness probe (DB + Redis reachable);
  200 when healthy, 503 when degraded. Point external uptime monitors here.
- `GET /api/metrics` — unauthenticated aggregate counters (no PII).
- `GET /api/health/projects` — owner-scoped per-project
  `lastSuccessAt`/`lastDrillAt`, requires auth.

## Environment variables

| Var | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend API key. When unset, emails are skipped (log-only). |
| `RESEND_FROM` | From-address for outbound mail (must be a verified Resend domain). |
| `ALERT_HEARTBEAT_HOURS` | Silent-stall threshold (default `24`). |
| `ALERT_WEBHOOK_URL` | Optional. When set, alerts also POST JSON here. |
