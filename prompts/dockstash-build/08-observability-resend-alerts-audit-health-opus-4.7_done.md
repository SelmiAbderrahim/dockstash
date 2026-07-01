# Observability — Resend, Failure Alerts, Audit Log & Health — Build Prompt

> **Make failure loud and every action traceable** — swap the communication
> transport from Mailgun to **Resend** (keeping the module shape), fire immediate
> alerts on any failed backup/restore/drill, run a dead-man's-switch heartbeat for
> silent stalls, append an immutable audit log (with IP), and expose a health +
> metrics surface — all transactional mail localized to the recipient's language.

---

## Agent

`backend-dev` (owns `server/src/modules/communication/*`, the alert/heartbeat
crons, the `AuditLog` model, and the `/health` + metrics surface). Reuse the
existing `pino`/`pino-http` structured logging.

## Mission

Per `IDEA.md` §7 and build-phase 5, silent failure is the #1 way backup systems
betray users. Make failure loud and actions auditable:

1. **Swap the email transport Mailgun → Resend**, keeping the `communication`
   module shape and the `sendEmail(message)` signature.
2. **Failure alerts** — any failed backup/restore/drill → immediate Resend email
   (+ optional webhook) with project, error, last-good timestamp.
3. **Dead-man's-switch heartbeat** — no successful backup in `ALERT_HEARTBEAT_HOURS`
   → alert (catches the silent-stall case where nothing errored but nothing ran).
4. **Append-only audit log** — who ran/restored/deleted/changed-plan, timestamp +
   IP.
5. **Health surface** — per-project `lastSuccessAt`/`lastDrillAt`; a `/health` +
   metrics endpoint for external uptime monitoring.
6. **Transactional emails via Resend** — welcome, password reset, payment receipt,
   dunning, drill-failure, heartbeat-miss — all localized to the recipient.

## Operating Constraints

| Rule | Detail |
|---|---|
| Keep module shape | Do **not** restructure `communication`. Replace `mailers/mailgun.ts` with `mailers/resend.ts`; **preserve the `sendEmail(message)` signature** and `communicationRouter`, `deliverContactForm`, `deliverPasswordResetEmail`. Callers stay unchanged. |
| Resend transport | `mailers/resend.ts` wraps the Resend SDK (or `fetch`) using `RESEND_API_KEY` + `RESEND_FROM` (zod-validated in `config/env.ts` by prompt 02). The transport is the **only** place Resend types appear; everything above it uses the neutral `message` shape. Injectable for tests. |
| Make failure loud | A failed backup/restore/drill must trigger an alert **before** the run is considered closed. An alert-send failure must not crash the orchestrator (log + continue) but must itself be logged at error level. |
| Heartbeat honesty | The dead-man's-switch fires on **absence** of a recent success, independent of any error — it must catch the case where nothing threw but nothing ran. Threshold from `ALERT_HEARTBEAT_HOURS`. |
| Audit immutability | `AuditLog` is **append-only**: no update/delete paths; capture actor, action, target, timestamp, and source IP (from the request, behind the proxy — trust `X-Forwarded-For` only per the documented proxy config). Restore + delete + plan-change are destructive/billable → must be traceable. |
| Localized mail | Every transactional + alert email is rendered in the **recipient's** language (7 locales), via the prompt-01 server `t(key, vars)`. No hardcoded English email bodies/subjects. |
| Reuse logging | Reuse the existing `pino` logger (`server/src/config/logger.ts`); never log secrets, decrypted creds, or full email bodies with PII. |
| No hardcoded URLs | Email links derive from `CLIENT_URL`/`SERVER_URL`; the from-address is `RESEND_FROM`. See `.claude/rules/site-url-env-pattern.md`. |
| Typed schemas | `AuditLog` via `InferSchemaType`, type exported, explicit `{ timestamps: true }`, enum literal actions. See `.claude/rules/mern-mongoose-typed-schemas.md`. |
| Named exports | No `export default`. See `.claude/rules/mern-no-default-exports.md`. |
| Excluded | No new billing/provider logic (prompt 06/07 own it — this prompt only *sends* the dunning/receipt mail those lifecycle transitions request); no client UI beyond surfacing health/audit if trivially reused. |

## Phases

### Phase 0 — Map the model
- 0.1 Read `server/src/modules/communication/`: `communication.service.ts`,
  `communication.controller.ts`, `communication.routes.ts`, `index.ts`
  (`communicationRouter`, `deliverContactForm`, `deliverPasswordResetEmail`), and
  `mailers/mailgun.ts` (the current `sendEmail(message)` transport + its `message`
  shape).
- 0.2 Read `server/src/config/env.ts` (`RESEND_API_KEY`, `RESEND_FROM`,
  `ALERT_HEARTBEAT_HOURS` added by prompt 02) and `server/src/config/logger.ts`.
- 0.3 Read the backup-core + scheduler modules to find the failure points
  (backup/restore/drill outcomes) and the per-project `lastSuccessAt`/`lastDrillAt`
  fields the alerts + health surface read.
- 0.4 Read `server/src/app.ts` for where to mount `/health` and the metrics route,
  and `server/src/shared/middleware/require-auth.ts` for protecting audit reads.

### Phase 1 — Resend transport swap
- 1.1 Add `mailers/resend.ts` implementing the **same** `sendEmail(message)`
  signature the rest of the module imports; wrap the Resend SDK/`fetch` with
  `RESEND_API_KEY` + `RESEND_FROM`. Injectable client for tests.
- 1.2 Repoint `communication.service.ts` imports from `mailgun.ts` → `resend.ts`;
  delete `mailgun.ts`. Keep `deliverContactForm` / `deliverPasswordResetEmail`
  behavior + signatures identical.
- 1.3 Remove the Mailgun env vars from `config/env.ts` + `.env.example`; confirm
  `RESEND_*` are required where appropriate.

### Phase 2 — Localized transactional templates
- 2.1 A `templates/` set rendered through `t(key, vars)` in the recipient's
  language: `welcome`, `passwordReset`, `paymentReceipt`, `dunning`,
  `drillFailure`, `heartbeatMiss`. Subject + body keys in all 7 locales; links from
  `CLIENT_URL`/`SERVER_URL`.
- 2.2 Resolve the recipient language from the user record (fallback: account
  default → `en`). Wire `paymentReceipt`/`dunning` to the prompt-07 lifecycle
  transitions (those emit; this renders + sends).

### Phase 3 — Failure alerts
- 3.1 `alert.service.ts` — `sendFailureAlert({ projectId, kind, error,
  lastGoodAt })` for `kind ∈ {backup, restore, drill}`: render the localized alert,
  send via `sendEmail`, optionally POST an alert **webhook** (URL from env/project
  config). Include project, error, last-good timestamp.
- 3.2 Hook it into the backup/restore/drill failure paths so a failed run alerts
  immediately. An alert-send failure logs at error level and never aborts the
  orchestrator.

### Phase 4 — Dead-man's-switch heartbeat
- 4.1 `heartbeat.service.ts` — `runHeartbeatSweep()`: for each project, if
  `now − lastSuccessAt > ALERT_HEARTBEAT_HOURS` (or never succeeded), send the
  `heartbeatMiss` alert. Idempotent — don't re-alert the same stall every sweep
  (track `lastHeartbeatAlertAt`/dedupe window).
- 4.2 Register on a schedule (reuse the project scheduler; cancelled on shutdown).

### Phase 5 — Audit log
- 5.1 `audit-log.model.ts` — `AuditLog` { actorUserId, action
  ('backup.run'|'backup.restore'|'backup.delete'|'plan.change'|…), targetType,
  targetId, ip, metadata, createdAt } — **append-only**, `{ timestamps: true }`.
- 5.2 `audit.service.ts` — `recordAudit(entry)` called from the restore, delete,
  Backup-Now, and plan-change paths; capture source IP from the request. No
  update/delete service paths exist.
- 5.3 A `requireAuth`-protected read endpoint (owner-scoped) to list a user's audit
  entries; ownership enforced with `HttpError.forbidden()`.

### Phase 6 — Health & metrics surface
- 6.1 `GET /health` (unauthenticated, liveness/readiness: DB + redis reachable) for
  external uptime monitoring; `GET /metrics` (or a metrics route) exposing
  aggregate counters reusing `pino`-tracked signals.
- 6.2 Surface per-project `lastSuccessAt`/`lastDrillAt` via an owner-scoped endpoint
  (and reuse in the dashboard health column where trivial).

### Tests
Server (`server/`, vitest, `fileParallelism:false`, v8 coverage, supertest against
`createApp()`, `startMemoryMongo`/`stopMemoryMongo`/`clearCollections`): **100%
coverage** (lines/branches/functions/statements). Mock the Resend transport
(`fetch`/SDK).
- Transport: `sendEmail(message)` posts to Resend with `RESEND_FROM`; the public
  signature is unchanged (existing `deliverContactForm`/`deliverPasswordResetEmail`
  callers still pass); a transport error surfaces without crashing the caller.
- Failure alerts: a failed backup, a failed restore, and a failed drill each fire
  exactly one alert carrying project + error + last-good timestamp; an alert-send
  failure is logged and does not abort the run.
- Heartbeat: a project whose last success is older than `ALERT_HEARTBEAT_HOURS`
  triggers `heartbeatMiss`; a project with a **fresh** success does **not**; a
  never-succeeded project alerts; no duplicate alert on the next sweep.
- Audit: restore, delete, Backup-Now, and plan-change each append an `AuditLog`
  with the correct action + source IP; there is no update/delete path; the read
  endpoint is owner-scoped (cross-user → `403`).
- Health: `GET /health` returns status reflecting DB/redis reachability; metrics
  route responds; per-project `lastSuccessAt`/`lastDrillAt` exposed owner-scoped.
- Localization: each email renders in the recipient's language (assert subject/body
  key resolution differs across `en`/`ar`/`zh`); no hardcoded English strings.

### i18n
7 locales — **en, ar, fr, de, es, ru, zh** — auto-detect + RTL (`ar`). All
**transactional + alert emails** (welcome, password reset, payment receipt,
dunning, drill-failure, heartbeat-miss) localized to the **recipient's** language
via the prompt-01 server `t(key, vars)` + per-user language; identical
interpolation vars across locales. Any audit/health API error returned to a caller
is localized too. Key-parity tests assert every email + error key exists in all 7
langs with matching placeholders.

### Documentation
- `/docs`: an "Alerts, audit & health" page (what triggers an alert, the heartbeat
  window, the audit trail, the `/health` + metrics endpoints for uptime
  monitoring). User-facing → all 7 locales.
- `ARCHITECTURE.md`: the Resend transport swap, alert + heartbeat crons, the
  `AuditLog` model, the health/metrics surface.
- `.env.example`: document `RESEND_API_KEY`, `RESEND_FROM`, `ALERT_HEARTBEAT_HOURS`;
  remove the Mailgun vars. `CHANGELOG.md` entry noting the Mailgun → Resend swap.

## Agents & Skills

- **Agents:** `backend-dev` (primary — transport swap, alerts, heartbeat, audit,
  health).
- **Skills:** `postal-transactional-email` (transactional transport pattern +
  deliverability reference); `backend-i18n` (recipient-language email rendering +
  key parity); `code-review` (final pass); `verify` (force a failed drill + a stale
  heartbeat and confirm the alert emails fire localized).

## Idempotency Contract

Re-running MUST NOT: re-add `mailers/mailgun.ts` (it is replaced by `resend.ts`),
duplicate the `AuditLog` model, schedule a second alert/heartbeat job, re-mount
`/health` or the metrics route, or re-alert a stall already alerted within the
dedupe window. Detect the already-swapped transport and converge; the audit log is
append-only by construction; the heartbeat is idempotent via
`lastHeartbeatAlertAt`; every run reaches the same final wiring.
