# IDEA.md — Dockstash: one-click backup orchestrator for Docker projects

> **What this is:** a MERN app that runs on a production VPS and makes backing up *any* Docker
> project one click. It orchestrates **Restic** (the proven backup engine) and puts a clean
> Shadcn UI on top. We do **not** reinvent backup logic — we make it effortless, secure, and
> billable.

This document is the architecture + product spec that drives implementation. It captures the
original design brief (Part A) and the five hardening requirements layered on top (Part B):
security, 100% tested, Polar payments (mirroring `/home/serverlessbase/pulsy`), a simple
subscription model, and Resend-level ease of use.

---

# Part A — Architecture brief

## Core decision: use Restic (or Kopia) as the engine

Don't write tar/rsync logic yourself. **Restic** is the right backbone:
- Deduplication, encryption, compression, snapshots, incremental backups built in
- Can back up to the storage VPS over SFTP/SSH out of the box
- Atomic snapshots with restore-to-any-point
- Battle-tested, single binary

Your MERN app becomes an **orchestrator + scheduler + UI** around Restic. You're not reinventing
backup; you're making it one-click.

> **Decision (confirmed): Restic** is the engine. Kopia is a viable alternative (better built-in
> dashboard/throughput) but Restic's single-binary SSH-out-of-the-box model is the cleanest fit.

## What "any Docker project" actually means

A Docker project at `/var/www/<project>` decomposes into 4 backup-able layers. Detect them
automatically:

| Layer | What to capture | How |
|-------|----------------|-----|
| **Volumes/bind mounts** | App data, uploads | Restic backs up the host paths |
| **Databases** | Postgres/MySQL/Mongo | `docker exec` → native dump (`pg_dump`, `mongodump`) *then* restic the dump |
| **Compose + config** | `docker-compose.yml`, `.env` | Restic the project dir |
| **Reverse proxy** | Traefik/nginx configs | Restic specific paths (e.g. `/etc/traefik`, dynamic config dirs) |

The critical rule: **never back up a live database file from disk.** Always dump first via the
running container, then back up the dump. This is the single most important correctness point and
where most homemade tools fail.

## Architecture

```
┌─────────────────────┐         SSH/SFTP          ┌──────────────────┐
│  PRODUCTION VPS     │ ────────────────────────► │  STORAGE VPS     │
│                     │                            │                  │
│  /var/www/*         │   Restic repo (encrypted)  │  Restic repos    │
│  Docker projects    │                            │  per project     │
│                     │                            │                  │
│  ┌───────────────┐  │                            │                  │
│  │ MERN Agent    │  │                            │                  │
│  │ - Express API │  │                            │                  │
│  │ - Restic exec │  │                            │                  │
│  │ - docker exec │  │                            │                  │
│  │ - node-cron   │  │                            │                  │
│  └───────┬───────┘  │                            │                  │
│          │          │                            │                  │
│  ┌───────▼───────┐  │                            │                  │
│  │ React+Shadcn  │  │                            │                  │
│  │ Dashboard     │  │                            │                  │
│  └───────────────┘  │                            │                  │
└─────────────────────┘                            └──────────────────┘
```

The MERN app runs **on production** (it needs Docker socket access and `/var/www` access). The
storage VPS just holds restic repos — it doesn't even need your app installed, just SSH access.

## Project detection via "adapters"

Use a **plugin/adapter pattern** so each project type knows how to dump/restore itself.
Auto-detect, but let the user override in UI.

```js
// Detect what's in a project, propose a backup plan
async function scanProject(projectPath) {
  const compose = parseCompose(`${projectPath}/docker-compose.yml`);
  const plan = { paths: [projectPath], databases: [], configs: [] };

  for (const [name, svc] of Object.entries(compose.services)) {
    const adapter = matchAdapter(svc.image); // postgres → pgAdapter, etc.
    if (adapter) {
      plan.databases.push({
        service: name,
        type: adapter.type,
        container: resolveContainerName(projectPath, name),
        dumpCmd: adapter.dumpCmd(svc),
        restoreCmd: adapter.restoreCmd(svc),
      });
    }
  }
  // detect traefik/nginx by image or known label
  plan.configs = detectProxyConfigs(compose);
  return plan;
}
```

Adapters you'd ship:

```js
const adapters = {
  postgres: {
    match: img => /postgres/.test(img),
    dumpCmd: svc => `pg_dumpall -U ${env(svc,'POSTGRES_USER')}`,
    restoreCmd: svc => `psql -U ${env(svc,'POSTGRES_USER')}`,
  },
  mysql: {
    match: img => /mysql|mariadb/.test(img),
    dumpCmd: svc => `mysqldump --all-databases -uroot -p${env(svc,'MYSQL_ROOT_PASSWORD')}`,
    restoreCmd: svc => `mysql -uroot -p${env(svc,'MYSQL_ROOT_PASSWORD')}`,
  },
  mongo: {
    match: img => /mongo/.test(img),
    dumpCmd: () => `mongodump --archive`,
    restoreCmd: () => `mongorestore --archive --drop`,
  },
};
```

A backup run for a DB then becomes:
```bash
docker exec <container> sh -c "<dumpCmd>" | restic backup --stdin --stdin-filename db.dump
```

> **Security note (see Part B §2):** the literal string-interpolated commands above are
> *illustrative*. In production these run through `dockerode` exec with **argument arrays**, never
> interpolated shell, to eliminate command injection.

## Stack

- **Backend:** Express + Mongoose (Mongo stores: projects, schedules, backup history, settings)
- **Engine:** Restic binary, invoked via `child_process` (arg arrays, no shell)
- **Scheduler:** `node-cron` for schedules; a job queue (`BullMQ`) if you want retries/logs/concurrency control — recommended
- **Realtime logs:** WebSocket (`socket.io`) streaming restic stdout to the UI
- **Docker introspection:** `dockerode` (cleaner and safer than shelling out to docker CLI)
- **Frontend:** React + Vite + Shadcn + Tailwind

## UX — keeping it "extremely simple"

The whole app is really 4 screens:

**1. Projects** — Auto-scanned cards for each `/var/www/*` folder. Each shows: last backup, size,
status badge. One big **Backup Now** button.

**2. Project detail** — The detected plan as toggles: ☑ Files ☑ Postgres DB ☑ Traefik config.
User just confirms what to include. A schedule picker (daily/weekly/cron). This is where adapters
surface as friendly checkboxes instead of config files.

**3. Backups/Snapshots** — Timeline list of restore points per project. Each row: date, size,
**Restore** button → confirmation dialog (this is destructive, so a typed-confirm `AlertDialog`).

**4. Settings** — Storage VPS connection (host, SSH key), retention policy (keep N daily/weekly),
encryption password.

Shadcn components that carry most of this: `Card`, `Badge`, `Switch`, `Dialog`/`AlertDialog`,
`Table`, `Sonner` (toasts), `Tabs`, `Progress`, `Form` + `react-hook-form`.

The "wow, this is easy" feeling comes from: **auto-detection** (user never writes a backup
config), **one-click restore with a safety confirm**, and **live streaming logs** so it never
feels like a black box.

## Two things to get right early

1. **Restore is dangerous.** Always restore DBs to a *staging* dump first or offer "restore to new
   location" vs "overwrite." Make destructive restore require typed confirmation.
2. **Secrets.** Restic encryption password and SSH keys must be stored encrypted at rest (not
   plaintext in Mongo). Use a master key from an env var / Docker secret, encrypt credentials with
   it.

## Don't-build-it alternative worth knowing

Before building, look at **Backrest** (open-source web UI for Restic) — it already does
scheduling, retention, and a UI for restic repos. If it covers 70% of your need, you could fork it
or run it alongside and build only the Docker-aware DB-dump + Traefik layer yourself. But if you
want the tailored Shadcn UX and Docker-project-aware adapters, building the orchestrator above is
the cleaner path.

> **Decision:** build the tailored orchestrator. The Docker-aware DB-dump adapters + per-project
> billing + Resend-grade UX are the product; Backrest can't deliver those. Keep it as a reference
> for restic-handling edge cases.

---

# Part B — Hardening & product requirements

This section is what turns the brief into a shippable, secure, monetizable product. It builds on
the existing MERN starter in this repo (`dockstash.com`), which already provides passport-JWT
auth, zod-validated env (`server/src/config/env.ts`), a typed `apiClient`
(`client/src/shared/api/client.ts`), Socket.IO, and a vitest + supertest + `mongodb-memory-server`
test harness. We **reuse** all of it.

## §1. Extremely secure — updated & verified tools

Security is a first-class requirement, not a later pass.

### Secrets at rest
- Restic repo password and the storage-VPS SSH private key are **never** stored plaintext in
  Mongo. Encrypt each with **AES-256-GCM** using a master key supplied via env / Docker secret:
  `MASTER_ENCRYPTION_KEY` (validated by `config/env.ts`, min 32 bytes).
- Decrypt only in-process at the moment of a restic/SSH invocation; never log decrypted values.
- Mirror pulsy's boundary discipline: provider access tokens and secrets **never leave the
  server**; the client only ever receives redirect URLs and non-sensitive state.

### Polar webhook security (mirrors pulsy `polar-handler.ts`)
- **Standard Webhooks HMAC-SHA256.** Construct `signed_content = "{id}.{timestamp}.{rawBody}"`,
  compute `HMAC-SHA256(secret, signed_content)`, timing-safe compare against the
  `webhook-signature` header.
- **Verify before parse.** Mount the webhook route with `express.raw({ type: '*/*' })` and verify
  the signature on the raw bytes *before* any `JSON.parse`. Never trust an unverified body.
- **Replay protection:** reject if `|now - webhook-timestamp| > 5 min`.
- Strict base64 decoding of signatures; reject non-round-tripping values.

### Command-injection guard
- All `docker exec` dump/restore and all `restic` invocations run via **`dockerode` exec /
  `child_process` with argument arrays**, never string-interpolated shell. (The interpolated
  examples in Part A are illustration only.)
- Validate every project path against a `/var/www/*` allowlist before it reaches restic.
- Never pass user-controlled strings into a shell context.

### Docker socket least-privilege
- Document the socket as a sensitive grant. Usage is read-mostly (inspect/exec). Recommend an
  optional **docker-socket-proxy** in front, exposing only the needed endpoints.

### Dependency policy
- Pin verified, current versions. Add an `npm audit --audit-level=high` **zero-high gate** in CI;
  builds fail on a new high/critical advisory.
- All new env vars flow through the existing zod schema in `server/src/config/env.ts` (fails hard
  on startup if misconfigured). No subdirectory `.env` files (repo rule).

### Destructive-restore safety
- Restore requires a **typed-confirm `AlertDialog`** (type the project name to proceed).
- Default mode is **"restore to new location"**; overwrite is opt-in.
- DB restores land in a **staging dump** first; overwrite of the live DB is a separate explicit
  step.

### Authorization
- Every project / backup / restore / schedule route sits behind `requireAuth`
  (`server/src/shared/middleware/require-auth.ts`).
- Per-user **ownership checks** on every project resource (a user can only touch projects they
  own). Use `HttpError.forbidden()` (`shared/utils/http-error.ts`) on violation.

### App-layer hardening
- **Rate limiting** on auth + webhook routes (`express-rate-limit`) to block brute force / abuse.
- **`helmet`** for security headers; **CORS** locked to `CLIENT_URL` only; **CSRF** protection on
  any cookie-borne auth (JWT-in-cookie → CSRF applies; double-submit token or SameSite=strict).
- **Zod request-body validation** on every mutating route (repo convention).

### Transport & key trust
- **SSH host-key pinning.** Pin the storage-VPS host key in `known_hosts`; reject on mismatch — no
  MITM on the backup channel. (§1's webhook HMAC covers inbound; this covers outbound.)
- **Restic password = total-data-loss risk.** Provide **recovery codes / key escrow** at storage
  setup: show the encryption password once, force the user to confirm they saved it, and store
  only the AES-256-GCM-encrypted copy. Losing it means repos are unrecoverable — make that
  explicit in the wizard.
- **Master key rotation.** Document a re-encrypt path: new `MASTER_ENCRYPTION_KEY` → decrypt with
  old, re-encrypt all secrets, atomic swap. Keep a `keyVersion` field on encrypted records.

### Agent privilege / threat model
- The agent runs with **high privilege** (reads `/var/www`, holds the Docker socket → effectively
  root-equivalent on the host). Document the blast radius. Mitigations: run behind a
  **docker-socket-proxy** exposing only needed endpoints, drop unused Linux capabilities, and
  treat the agent container as a crown-jewel asset.
- **Multi-tenant isolation** (if hosted): one restic repo namespace per user, path-traversal
  guards on every project path, no cross-tenant container access.

### Provider state integrity
- **Webhook reconciliation job.** A periodic cron polls Polar for active subscriptions and heals
  state drift from any dropped/missed webhook (Polar outage, our downtime). Pulsy self-heals the
  customer-portal link only; we add full subscription reconciliation.

## §2. 100% test coverage, 100% pass rate

- **Server:** vitest + supertest + `mongodb-memory-server` (existing harness in
  `server/src/shared/testing/mongo.ts`: `startMemoryMongo` / `stopMemoryMongo` /
  `clearCollections`). Enable v8 coverage with a **100% gate** on lines/branches/functions/
  statements in `vitest.config.ts`; CI fails below threshold.
- **Injectable boundaries for determinism.** Wrap the four external systems behind interfaces so
  orchestration logic is unit-testable without real infra:
  - Restic CLI runner
  - `dockerode` Docker client
  - SSH/SFTP transport
  - Polar REST client
  Inject mocks in unit tests; run the webhook pipeline end-to-end against **signed fixtures** in
  integration tests.
- **Adapters:** table-driven tests per DB type — detection (`match`), `dumpCmd`, `restoreCmd`.
- **Polar billing:** replicate pulsy's webhook test matrix — valid signature, tampered body,
  replayed timestamp, duplicate `eventId` (idempotency), unhandled-event skip.
- **Client:** vitest + React Testing Library for the 4 screens; explicitly cover loading, empty,
  and error states (per `.claude/rules/ui-ux-patterns.md`).
- Test the **public API** of each module, not internals (repo convention).

### Beyond coverage — correctness tests (100% coverage ≠ correct)
- **Real-restic integration tests.** Run against an actual `restic` binary in a throwaway
  container (not just a mock) so command construction, locking, and exit codes are exercised.
- **Restore round-trip diff.** The cardinal test: seed data → backup → restore to scratch →
  byte/row-diff original vs restored. A backup that can't restore is a failure.
- **Failure injection.** Kill mid-backup, fill the disk, drop the network, present a stale restic
  lock — assert the orchestrator fails safe and reports correct status, never a false "success".
- **DB-dump consistency tests** per adapter (torn-write detection).
- **CI/CD pipeline (new).** The repo currently has none; add one (GitHub Actions or equivalent,
  **running in Docker**) that executes: typecheck → lint → unit + integration tests → 100%
  coverage gate → `npm audit --audit-level=high` zero-high gate. These gates are inert without a
  runner.

## §3. Polar payments (mirrors `/home/serverlessbase/pulsy`)

Polar is the active payment provider, behind a provider abstraction. The existing Stripe code is
archived behind the same interface (not deleted), so the system stays multi-provider-capable.

### Module layout — `server/src/modules/billing/`
- `payment-provider.ts` — `IPaymentProvider` interface: `createCheckout`, `openPortal`,
  `changePlan`, `verifyWebhook`, `parseEvent`.
- `providers/polar.ts` — **fetch-based REST client, no `@polar-sh/sdk`** (pulsy's deliberate
  choice for control/portability). Sandbox vs prod base URL from `POLAR_SERVER`; bearer
  `POLAR_ACCESS_TOKEN`; optional `Idempotency-Key` header hook; `Retry-After` parsing for backoff.
- `providers/stripe.ts` — existing Stripe logic moved behind `IPaymentProvider` (inactive).
- `active-provider.ts` — `PAYMENT_PROVIDER` env selects the active provider (factory).
- `webhook/` — verify-before-parse handler + ingestion pipeline (verify → dedupe → dispatch →
  persist). Dispatch registry upserts `Subscription` / `Customer` / `Order`.
- `plans.ts` — in-memory **entitlements matrix** keyed by plan slug (`free` / `pro` / `business`):
  per-project caps + feature flags (retention days, min backup interval, schedules allowed,
  multi-VPS).
- `polar-config.ts` — plan-slug ↔ Polar **product UUID** map, plus a **reverse lookup**
  (`getPlanForProductId`). Per pulsy: `product_id` is the robust source of truth for resolving a
  subscription back to a plan (checkout metadata isn't guaranteed to propagate).

### Webhook idempotency (mirrors pulsy)
- `WebhookEvent` model with a **unique `(provider, eventId)` index**. INSERT-first as `pending`;
  duplicate deliveries short-circuit to `200` without re-dispatch; mark `processed` / `failed` /
  `skipped` after handling; track `retryCount`.

### Subscription lifecycle events handled
- `subscription.created` / `.updated` / `.active` → upsert `Subscription` by
  `providerSubscriptionId`, link `Customer`.
- `subscription.canceled` / `.revoked` → mark canceled / `cancelAtPeriodEnd`.
- `order.created` / `.paid` / `.refunded` → upsert `Order` (charge history).

### Env vars (add to `config/env.ts` + `.env.example`)
`PAYMENT_PROVIDER`, `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_SERVER`,
`POLAR_PRO_PRODUCT_ID`, `POLAR_BUSINESS_PRODUCT_ID`, `MASTER_ENCRYPTION_KEY`,
`RESEND_API_KEY`, `RESEND_FROM`, `ALERT_HEARTBEAT_HOURS`.

### Mongo schemas (typed via `InferSchemaType`, repo rule)
`Subscription`, `Customer`, `Order`, `WebhookEvent`, `PricingTier`. Replace the current Stripe blob
on the `User` model with provider-neutral `customer` / `subscription` references.

### Client
- Thin `client/src/features/billing/api.ts` over `apiClient`.
- Pricing grid: new users → checkout → `window.location.href = url`; existing paid users →
  in-app **changePlan** (proration). Access token never reaches the client.
- Subscription state lives on a billing page with **`?tab=`** URL state (repo rule
  `url-tab-state.md`): Overview (plan, status, renewal) + Usage (projects used vs cap).

## §4. Simple, attractive subscription model

Per-project metering. Three tiers, easy to grok at a glance:

| Plan | Price | Projects | Retention | Frequency | Extras |
|------|-------|----------|-----------|-----------|--------|
| **Free** | $0 | 1 | 7 days | daily | community support, self-host default |
| **Pro** | $X/mo | 10 | 30 days | hourly | schedules, email alerts |
| **Business** | $Y/mo | unlimited | 90 days | any cron | priority support, multi-VPS |

- **Yearly variants** of Pro/Business at "2 months free" (10× monthly).
- Entitlements enforced **server-side** via the `plans.ts` matrix — checked on **Backup Now** and
  on **schedule create** (block + prompt to upgrade when over cap).
- The **Free** tier is the open-source / self-host default (works fully without a paid provider
  configured).
- `PricingTier` rows in Mongo mirror the matrix and carry the Polar `productId` (nullable for
  Free), so pricing is data-backed and editable without a redeploy.

### Lifecycle edge cases (must be explicit)
- **Dunning / payment failure.** Failed renewal → status `past_due` → **grace period** (e.g. 14
  days) with Resend dunning emails → only then downgrade to Free entitlements. Driven by Polar
  `order`/`subscription` webhooks.
- **Backups never deleted on lapse.** When a subscription lapses, user data is **not** purged.
  Backups go **read-only** (no new runs beyond Free cap), retained for a defined grace window
  before any pruning. Losing someone's backups because a card expired is unacceptable.
- **Downgrade over-cap.** Going from Pro(10) → Free(1) with 8 projects: no silent deletion. User
  must pick which project stays active; the rest become read-only/paused until they re-upgrade.
- **Tax / merchant of record.** Polar is **MoR** — it handles VAT/sales-tax and invoicing; we
  don't compute tax. Note this so no one builds a tax engine.
- **Refund / chargeback** → revoke entitlement via `order.refunded` webhook; move to Free.
- **Trial abuse** guard if a free trial is offered (one trial per customer/email).

## §5. Resend-level simplicity of use

The product promise: integrate and run with the fewest possible buttons and steps.

- **Zero backup config.** Auto-detection (`scanProject`) means the user never authors a backup
  plan file — they confirm friendly checkboxes.
- **4 screens, one primary action each:** Projects → *Backup Now*; Snapshots → *Restore*;
  Settings → *Connect storage*; Project detail → *Save schedule*.
- **One-time setup wizard:** paste storage-VPS SSH target + choose an encryption password → done.
  Everything after that is one click.
- **Live-streaming restic logs** over Socket.IO (reuse existing socket infra) — a backup is never
  a black box; the user watches progress in real time.
- **Honest, accessible UI** per `.claude/rules/ui-ux-patterns.md`: flat borders, 6px button
  radius, 150ms `color`/`opacity` transitions only — no gradients, no card-lift, no pulse.
  Loading/empty/error states everywhere; destructive actions gated by typed confirm.

## §6. Reliability, verification & disaster recovery

A backup tool that can't prove its backups restore is not a product. This section is non-optional.

### Backup verification (an untested backup = no backup)
- **`restic check`** on a schedule per repo (structure + optional `--read-data-subset` for data
  integrity).
- **Automated restore drill.** Periodically restore the latest snapshot to a scratch location and
  **diff against source** (rows for DBs, bytes for files). A green drill is the only proof a backup
  is real. Surface drill status per project in the UI.

### Concurrency, locking & retention execution
- **One job per repo.** Serialize backup/prune/check on a given repo through a **BullMQ** queue —
  this is why the job queue is *required*, not optional. Concurrent restic ops on one repo corrupt
  or deadlock.
- **Stale-lock recovery.** Detect orphaned restic locks (crashed run) and `restic unlock` safely
  before retry.
- **Retention = `forget --prune`.** Prune is **destructive, slow, and lock-holding** — schedule it
  as its own serialized job, never inside a backup run. Document the retention policy → forget
  flags mapping (`--keep-daily/-weekly/-monthly`).
- **Job timeouts + stuck-job detection**; auto-retry with backoff (BullMQ), capped attempts, then
  alert.

### Backup correctness
- **DB-dump consistency:** `mysqldump --single-transaction`, Postgres consistent snapshot, Mongo
  `--oplog`. Torn dumps are silent data loss.
- **Per-project atomicity.** If any layer (a DB dump, a path) fails, the project snapshot is marked
  **failed**, not partial-success. Clear status, no false green.
- **Disk-space safety.** Prefer **stream dump → `restic --stdin`** over spooling to a temp file;
  where a temp file is unavoidable, pre-check free space and clean up. Out-of-space mid-dump must
  fail cleanly.
- **Pre/post hooks** (optional per project): quiesce/flush before, resume after.

### Disaster recovery of the tool itself
- **Who backs up the backup tool?** The orchestrator's Mongo (projects, schedules, **encrypted
  secrets**, history) is itself backed up to the storage VPS on a schedule.
- **Config export / import.** One-command export of repo definitions + encrypted secrets so a
  fresh agent on a new production VPS can re-attach to existing storage repos. Production VPS dies
  → stand up a new agent → import → restores work.
- **Bootstrap recovery doc:** exact steps to recover from "production VPS is gone", assuming only
  the storage VPS + the master key + recovery codes survive.

## §7. Observability & alerting (Resend)

Silent failure is the #1 way backup systems betray users. Make failure loud.

- **Email engine: Resend.** The starter's Mailgun/SendGrid integration is replaced by **Resend**
  (`RESEND_API_KEY`, `RESEND_FROM`) — Resend-grade DX matches the product's simplicity goal. The
  `communication` module wraps the Resend SDK; all transactional + alert mail flows through it.
- **Failure alerts.** Any failed backup / failed restore / failed drill → immediate Resend email
  (and optional webhook). Includes project, error, last-good timestamp.
- **Dead-man's-switch / heartbeat.** If a project has had **no successful backup in
  `ALERT_HEARTBEAT_HOURS`**, alert — catches the silent-stall case where nothing errored but
  nothing ran.
- **Audit log.** Append-only record of who ran/restored/deleted/changed-plan, with timestamp + IP.
  Restore and delete are destructive + billable → must be traceable.
- **Health surface.** Per-project `lastSuccessAt` / `lastDrillAt` in the UI; a `/health` +
  metrics endpoint for external uptime monitoring. Reuse existing `pino` structured logging.
- **Transactional emails via Resend:** welcome, password reset, payment receipt, dunning,
  drill-failure, heartbeat-miss.

## §8. Data lifecycle & legal

- **GDPR / data rights.** Backups contain user data. Provide **data export** and **right-to-
  deletion**; define what account deletion does to stored backups (grace window, then purge) and
  surface it in Terms.
- **Account deletion → backup fate.** Explicit policy: deletion schedules repo purge after a grace
  period, with a final Resend warning email.
- **Data residency.** Document where the storage VPS lives; let Business-tier pick a region if
  required.
- **Legal hold vs retention.** Retention auto-prune must respect an optional hold flag.

## §9. Docker-first deployment (everything runs in Docker)

> This **supersedes the starter's "No Docker" stance** (`CLAUDE.md` §9). The whole system —
> server, client build, Mongo, queue, agent, CI — runs in containers.

- **`docker-compose.yml`** orchestrates: `api` (Express + restic + dockerode), `web` (built
  Vite static, served by the api or an nginx container), `mongo`, `redis` (BullMQ), and the
  `docker-socket-proxy`.
- **Agent container** mounts the Docker socket **via the socket-proxy** (least privilege) and the
  `/var/www` tree read-mostly. `restic`, `pg_dump`/`mysqldump`/`mongodump` clients are baked into
  the image so no host tooling is assumed.
- **Multi-VPS (Business tier).** Each production VPS runs an **agent container** that authenticates
  to the control plane with a per-agent token (issued in UI, revocable). The control plane never
  needs SSH into production; agents pull their work.
- **Secrets** (`MASTER_ENCRYPTION_KEY`, `POLAR_*`, `RESEND_API_KEY`) injected as **Docker secrets /
  env**, never baked into images.
- **CI in Docker.** The pipeline (§2) builds and tests inside containers for parity with prod.
- **Healthchecks** on every compose service; restart policies; named volumes for Mongo + redis.
- Backups of the orchestrator's own Mongo (§6 DR) run from inside the stack to the storage VPS.

---

# Build phases (spec-driven, per repo rule)

1. **Dockerize the stack** (compose: api / web / mongo / redis / socket-proxy) + strip demo
   features (messaging / pages / sales / template) → keep auth + shared infra.
2. **Backup core:** `scanProject` + adapters + restic orchestration (injectable runners) + locking
   + **verification (check + restore-drill)** + tests.
3. **Scheduler + queue:** **BullMQ** (one-job-per-repo, retries, stuck-job + stale-lock recovery) +
   `node-cron` triggers + Socket.IO log streaming.
4. **Polar billing** behind `IPaymentProvider` + webhook pipeline + reconciliation cron + dunning/
   lapse policy + tests.
5. **Observability & email:** swap mailer to **Resend**, failure alerts + heartbeat dead-man's-
   switch + audit log + health surface.
6. **DR:** orchestrator-Mongo self-backup + config export/import + bootstrap-recovery doc.
7. **Shadcn 4-screen dashboard** (+ setup wizard, drill status, billing `?tab=`).
8. **Security + legal pass:** secret encryption + rotation/escrow, rate-limit/helmet/CSRF, SSH
   host-key pinning, GDPR export/delete; **CI in Docker** with `npm audit` + **100% coverage**
   gates.

## Reused building blocks (already in this repo)
- `server/src/config/env.ts` — zod env validation (extend with the new vars)
- `server/src/shared/testing/mongo.ts` — in-memory Mongo test harness
- `server/src/shared/middleware/require-auth.ts` — JWT auth guard
- `server/src/shared/utils/http-error.ts` — typed HTTP errors
- `client/src/shared/api/client.ts` — typed `apiClient`
- existing `server/src/modules/billing/*` — refactor behind `IPaymentProvider`
- existing `server/src/modules/communication/*` — **swap Mailgun → Resend** (keep the module
  shape, replace the transport)
- existing Socket.IO infra (`server/src/server.ts`, chat socket) — reuse for live backup-log
  streaming

## Pulsy references to mirror (`/home/serverlessbase/pulsy`)
- `apps/server/src/services/polar.ts` — REST client factory
- `apps/server/src/payments/providers/polar.ts` — provider impl (checkout/portal/changePlan)
- `apps/server/src/webhooks/handlers/polar-handler.ts` — signature verification
- `apps/server/src/webhooks/webhook-router.ts` — verify → dedupe → dispatch → persist
- `apps/server/src/billing/plans.ts` — entitlements matrix
- `apps/server/src/billing/pulsy-polar-config.ts` — plan ↔ product-id mapping + reverse lookup
