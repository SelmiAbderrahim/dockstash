# Changelog

## 0.1.0 — 2026-08-03

First tagged release. Dockstash becomes an open-source, self-hostable product
under AGPL-3.0.

Versioning restarts here. `client` and `server` previously carried `2.0.0` and
`agent` carried `0.4.0`; those were inherited from the upstream MERN starter
this repository was forked from and never described a Dockstash release. All
three packages are now `0.1.0` and move together.

### Dockstash is now open source (AGPL-3.0), self-hostable

Dockstash is released as **AGPL-3.0-only** open source. Every billing, tiering,
and platform-operator surface is removed from this repository; the managed
service at dockstash.com runs the same codebase with its metering layer kept
outside it. Anyone upgrading an existing install must read this entry before
pulling.

**License.** The repository moves from Apache-2.0 to **AGPL-3.0-only**. §13
applies: if you run a modified Dockstash as a network service, you must offer
your users the source of that modified version. The app footer now carries that
offer — set `VITE_SOURCE_URL` to your fork when you deploy modifications
(blank points upstream). A separate commercial license is available for
organizations that cannot use AGPL software; contributions therefore require the
one-line CLA in `.github/CLA.md`, which is a license grant, not a copyright
assignment. The Apache-only `NOTICE` file is removed.

**Removed: the public marketing surface.** The landing page, pricing page,
alternatives/comparison pages, guides hub, FAQ, privacy and terms pages, and
every locale-prefixed route under them are deleted. `/` — and any unmatched
URL — now redirects to `/login` when signed out and `/dashboard` when signed in.

**Removed: SSR, SEO, and analytics.** `client/server.js` is now a plain static
server (hashed assets + `index.html` history fallback). The Vite SSR entry, the
client SEO layer, and the server `seo` module are deleted, which removes
`/robots.txt`, `/llms.txt` and all five sitemap endpoints. The inline Google
Analytics snippet and every `googletagmanager.com` / `google-analytics.com` CSP
allowance are gone. **Dockstash now ships no third-party telemetry of any kind.**

**Removed: two dead billing flags that were still enforced.**
`Agent.blockedByBilling` and `Schedule.pausedByBilling` lost their only writer
when the lifecycle service was deleted, but the agent flag was still **read** in
`claimNextJob` — an agent flagged under the old billing rules would have stopped
leasing jobs permanently, with no code path left to clear it. Both fields and
the guard are removed. Existing rows carrying either flag are now ignored;
Mongoose drops the unknown key on the next write.

**Removed: payments and entitlements, end to end.** The entire `billing` module
is deleted — the Polar provider, the inactive Stripe adapter, the webhook
pipeline (`POST /api/billing/webhook` no longer exists), the plan catalog, the
subscription/customer/order/usage models, the pricing-tier seeder, and the
invitation surface. **Every cap is lifted by construction**: unlimited projects
and agents, any cron cadence (including 1-minute), unbounded retention, and
alerts, mirror, PITR and restore drills always on. The `paused` project state
and the `pausedByBilling` schedule flag are removed with the code that set them.

**Removed: the Superadmin console and the role itself.** The `/api/superadmin`
surface, its 12 routes, the client console and its 6 tabs, and the
`seed-superadmin` CLI are deleted. `ROLE_SUPERADMIN` is dropped from the role
enum — the ladder now tops out at `Admin` (`Member` < `Client` < `Owner` <
`Admin`). `/api/recovery/self-backup` is regated on `ROLE_ADMIN`. The
Superadmin-only device-OTP second factor is removed along with
`POST /api/auth/otp/verify`, the login-challenge and trusted-device models, and
the OTP mailer — there is no Admin-tier replacement.

**Removed environment variables.** Delete these from your `.env`; they are no
longer read, and `.env.example` no longer lists them:

```
PAYMENT_PROVIDER            POLAR_ACCESS_TOKEN            POLAR_WEBHOOK_SECRET
POLAR_SERVER                POLAR_PRO_PRODUCT_ID          POLAR_BUSINESS_PRODUCT_ID
POLAR_PRO_YEARLY_PRODUCT_ID POLAR_BUSINESS_YEARLY_PRODUCT_ID
SUPERADMIN_EMAIL            SUPERADMIN_PASSWORD
VITE_SITE_URL               VITE_GA_ID                    API_INTERNAL_URL
RATE_LIMIT_WEBHOOK_WINDOW_MS  RATE_LIMIT_WEBHOOK_MAX
STRIPE_SECRET_KEY           SENDGRID_API_KEY              MAILCHIMP_API_KEY
```

`.env.example` is reorganized into a **REQUIRED** block
(`MASTER_ENCRYPTION_KEY`, `JWT_SECRET`, `SESSION_SECRET`, `MONGODB_URI`,
`REDIS_URL`, `CLIENT_URL`, `SERVER_URL`, `VITE_API_BASE_URL`,
`VITE_SOCKET_URL`) and an **OPTIONAL** block where every value has a working
default. The stale `./secrets/` instructions — which never matched the compose
file — are removed.

**Migration notes for an existing install**

- Remove the variables listed above from `.env`, then
  `docker compose up -d --build`. The api ignores unknown vars, so leaving them
  is harmless but misleading.
- **Any account with `role: "Superadmin"` loses its role.** Promote it to
  `Admin` before or after upgrading:
  `db.users.updateOne({email:"…"},{$set:{role:"Admin"}})`.
- Paused projects and billing-paused schedules are no longer paused. If a
  project was paused by a downgrade, it resumes on the next scheduled run.
- Existing `subscriptions`, `customers`, `orders`, `usagecounters`,
  `pricingtiers`, `webhookevents`, `invitations`, `loginchallenges` and
  `trusteddevices` collections are orphaned. Nothing reads them; drop them at
  your convenience.
- The `blockedByBilling` (agents), `pausedByBilling` (schedules), `paused`
  (projects) and `stripe` (users) fields are orphaned on existing documents.
  They are no longer read. Optional cleanup:
  `db.agents.updateMany({},{$unset:{blockedByBilling:""}})` and the equivalent
  for the other three.
- Bookmarks to `/billing`, `/pricing`, `/superadmin` and `/invite/:token` now
  fall through to the root redirect.
- Optionally set `VITE_SOURCE_URL` if you deploy a modified build (AGPL §13).

**Added: open-source packaging.** `README.md` is rewritten as the project front
page. New `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1),
`SECURITY.md`, `.github/CLA.md`, `CONTRIBUTORS.md`, GitHub issue/PR templates,
and `dependabot.yml`. All three packages declare `license: AGPL-3.0-only` with
repository/homepage/bugs metadata and are renamed `dockstash-client` /
`dockstash-server` / `dockstash-agent`; the inherited MERN-starter author and
ISC license are gone.

**Changed: the in-app footer.** The app-frame footer linked `/guides`,
`/security`, `/privacy` and `/terms` — all deleted marketing routes. Those dead
links are replaced by the AGPL §13 source-code link, which is asserted by a
test so it cannot silently disappear. `nav.home` and the `sidebar.footer.*`
keys are dropped from all seven locales; `footer.source` is added.

**Added: `docs/self-hosting.md`**, replacing `docs/running-with-docker.md` —
requirements, quick start, the `make` targets, reverse proxy + TLS snippets,
creating the first account (there is no seeder any more), the
`MASTER_ENCRYPTION_KEY` backup warning, upgrading, and troubleshooting. New
`docs/README.md` indexes all 87 doc files. `docs/plans-and-limits.*` and
`docs/polar-billing-and-webhooks.*` (14 files) are deleted.

**Unchanged.** The `agent/` package needed no changes — the daemon never
imported billing or superadmin. Backups, schedules, snapshots, restores,
restore drills, health, alerting, audit, the fleet surface, data rights, the
seven locales and the design system all behave exactly as before, minus the
gates.

## Unreleased

### Fleet agents on every plan (metered) (prompt 12)

The fleet stops being a Business-only boolean and becomes a per-plan metered
resource — **Free = 1, Pro = 5, Business = unlimited** connected servers. A
paying Pro customer can now register agents and back up their servers.

- **Entitlement change** — `Entitlements.multiVps: boolean` → `agents: number`
  (1 / 5 / ∞). Prices, projects, retention, frequency, and every other flag are
  unchanged.
- **Atomic cap enforcement** — agent registration reserves a slot via the
  existing `UsageCounter` atomic `$lt`-cap `$inc` idiom (`reserveAgentSlot` /
  `releaseAgentSlot` / `reconcileAgentCounter`); deletion releases it. Read and
  maintenance agent routes lose the plan gate — owner-scoping is the only guard.
- **Reason-code migration** — `multiVpsLocked` → `agentLimitReached` (carries
  `{ used, cap }`) across server dictionaries, client fleet typing, and the UI.
- **UI** — the `/fleet` tier-lock card is replaced by an at-cap upgrade upsell;
  the billing grid shows a "Connected servers" row (1 / 5 / Unlimited) and the
  usage tab a servers used/cap stat. Marketing pricing/fleet/FAQ pages, all 7
  locales, and the plans/fleet docs reflect the per-plan counts.

### Observability — Resend, alerts, audit & health (prompt 08)

Makes failure loud and every action traceable.

- **Resend transport** — `communication/mailers/resend.ts` replaces
  `mailgun.ts` while preserving the neutral `sendEmail(message)` signature.
  Mailgun env vars (`MAILGUN_PRIVATE_KEY`, `MAILGUN_DOMAIN`) removed.
- **Localized transactional emails** — `welcome`, `paymentReceipt`, `dunning`,
  `drillFailure`, `backupFailure`, `restoreFailure`, `heartbeatMiss`; every
  subject + body key exists in all 7 locales with matching placeholders.
- **Failure alerts** — `alerting.sendFailureAlert({ projectId, kind, error })`
  fires on failed backup / restore / drill. Emits a localized Resend email +
  optional JSON POST to `ALERT_WEBHOOK_URL`. Best-effort: transport failures
  are logged and never crash the orchestrator.
- **Dead-man's-switch heartbeat** — `alerting.runHeartbeatSweep()` alerts when
  a project's last-good backup is older than `ALERT_HEARTBEAT_HOURS`. Idempotent
  via `Project.lastHeartbeatAlertAt`. Registered as `__heartbeat__` cron on
  scheduler runtime.
- **Audit log** — `AuditLog` collection (`InferSchemaType`-typed), append-only.
  Hooked into billing `changePlan`, scheduler `enqueue` / `delete`. Read via
  `GET /api/audit` (owner-scoped).
- **Health & metrics** — `GET /api/health` (readiness), `GET /api/metrics`
  (aggregate counters), `GET /api/health/projects` (owner-scoped last-success).
- **Env** — added `ALERT_WEBHOOK_URL` (optional). Removed `MAILGUN_PRIVATE_KEY`
  and `MAILGUN_DOMAIN`.

### Plans, entitlements, lifecycle & billing UI (prompt 07)

Turns subscriptions into enforced product limits.

- **Entitlements matrix** — `server/src/modules/billing/plans.ts` — typed
  `ENTITLEMENTS` keyed by `free`/`pro`/`business` (projects, agents, retentionDays,
  frequency, schedules/emailAlerts flags). Monthly + yearly pricing
  (yearly = monthly × 10, "2 months free").
- **`PricingTier` model** — data-backed pricing editable without a redeploy;
  `pricing-tier.seed.ts` upserts idempotently from the matrix and preserves
  operator edits to `priceMonthly`/`priceYearly`/`active`.
- **`polar-config.ts`** — `PLAN_TO_PRODUCT` (slug → Polar product UUID) with
  `getPlanForProductId`/`getProductIdForPlan`/`getIntervalForProductId`;
  yearly product-id env keys added (`POLAR_PRO_YEARLY_PRODUCT_ID`,
  `POLAR_BUSINESS_YEARLY_PRODUCT_ID`). Product id is the source of truth.
- **Server enforcement** — `resolveEntitlements(userId)` maps subscription
  state to effective slug (OSS default without a provider → business).
  `assertProjectCap` blocks Backup-Now on over-cap (403 `projectLimitReached`);
  `assertScheduleAllowed` blocks schedule-create (403 `schedulesLocked` /
  `frequencyNotAllowed`). Wired into `backups.runBackup` and
  `scheduler.createSchedule`.
- **Lifecycle** — `lifecycle.service.ts` owns dunning (`past_due` → 14-day
  grace), `expireGraceIfNeeded` (past-grace demote to Free, over-cap projects
  paused — never deleted), `handleDowngrade` (pauses newer projects, marks
  `selectionRequired`), `selectProjectsToKeep` (user picks the survivors),
  `handleRefund` (`revoked` + Free), and one-trial-per-email guard on
  `Customer.trialClaimedAt`.
- **`Project.paused`** — new flag; enforced by `runBackup` to keep backups
  read-only under caps. No delete, ever.
- **Client billing surface** — `PricingGrid` (monthly/yearly toggle; new users
  → `createCheckout` redirect; existing paid → in-app `changePlan`),
  `BillingPage` with `?tab=overview|usage` per `.claude/rules/url-tab-state.md`,
  and a downgrade `selection-required` UI in the Usage tab. New routes
  `/pricing` (public) and `/billing`.
- **i18n** — new `billing.entitlements.*` server keys and
  `billing.grid/page/overview/usage/selection.*` client keys added across all
  7 locales.
- **Polar is Merchant of Record** — MoR handles VAT / sales tax / invoicing;
  no tax engine is built here.

### Billing — provider abstraction + Polar core & webhook subsystem

Refactored `server/src/modules/billing/` behind a provider abstraction and stood
up Polar as the active payment provider.

- **Interface** — `IPaymentProvider` with provider-neutral DTOs
  (`CreateCheckoutInput/Result`, `OpenPortalInput/Result`, `ChangePlanInput`,
  `NormalizedSubscription`, `NormalizedCustomer`, `NormalizedOrder`,
  `ParsedEvent`).
- **PolarProvider** — fetch-based REST client (no SDK), sandbox vs prod base URL
  from `POLAR_SERVER`, bearer from decrypted `POLAR_ACCESS_TOKEN`,
  `Idempotency-Key` support, `Retry-After` parsing. `setPolarRestClientFactory`
  is the DI seam for tests.
- **StripeProvider** — the pre-refactor Stripe surface behind the same
  interface, INACTIVE by default. All methods throw until re-enabled.
- **Models** — new `Customer`, `Subscription`, `Order`, `WebhookEvent`
  Mongoose models (all `InferSchemaType`-typed, all `{ timestamps: true }`),
  each with the appropriate compound-unique index.
- **User** — added provider-neutral `customer` / `subscription` ObjectId refs.
  The legacy Stripe blob is retained for migrate-by-tolerance reads and is no
  longer written by the new surface.
- **Webhook pipeline** — verify → dedupe → dispatch → persist. Signature check
  runs on the RAW bytes (Standard Webhooks HMAC-SHA256, strict base64,
  `timingSafeEqual`, ±5-min replay reject) BEFORE any `JSON.parse`. Duplicate
  delivery short-circuits to 200 via the `(provider, eventId)` unique guard.
- **Raw-body precedence** — `POST /api/billing/webhook` is registered with
  `express.raw({ type: '*/*' })` **before** the global JSON parser in `app.ts`
  so the ingest pipeline sees an unparsed Buffer.
- **Token at rest** — `POLAR_ACCESS_TOKEN` is wrapped in an `EncryptedSecret`
  envelope (AES-256-GCM via `MASTER_ENCRYPTION_KEY`) on first read and decrypted
  only in-process at call time. Never logged or returned.
- **Reconciliation cron** — `reconcileSubscriptions()` polls Polar every 15 min
  and heals drift on local `Subscription` rows (never creates rows Polar does
  not report; one failing record does not abort the loop).
- **i18n** — new `billing.error.*` keys in all seven locales with identical
  placeholders; operator-facing HTTP errors on the billing surface flow through
  the shared error handler (localized via `req.t`).

**Breaking:** `handleStripeWebhook` / `createSubscriptionForUser` /
`changeSubscriptionForUser` / `deleteSubscriptionForUser` /
`getCustomerForUser` / `updateCustomerBillingInfoForUser` and the
`POST /api/billing/webhook-notify`, `PUT/POST/DELETE /api/billing/customer`,
`PUT/DELETE /api/billing/subscription` endpoints are removed. Replaced by
`POST /api/billing/checkout`, `GET /api/billing/portal`,
`POST /api/billing/change-plan`, and the raw-body
`POST /api/billing/webhook`.
