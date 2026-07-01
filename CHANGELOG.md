# Changelog

## Unreleased

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
  `ENTITLEMENTS` keyed by `free`/`pro`/`business` (projects, retentionDays,
  frequency, schedules/emailAlerts/multiVps flags). Monthly + yearly pricing
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
