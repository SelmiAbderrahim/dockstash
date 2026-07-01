# Polar Billing Core & Webhook Subsystem — Build Prompt

> **Make Polar the active payment provider behind a clean abstraction** — a
> fetch-based REST client (no SDK), Standard-Webhooks verify-before-parse
> ingestion with idempotent dedupe, provider-neutral `Subscription`/`Customer`/
> `Order`/`WebhookEvent` Mongo models, and a reconciliation cron that heals state
> drift. Stripe is kept behind the same interface, inactive.

---

## Agent

`backend-dev` (owns `server/src/modules/billing/*`, the new `payment-provider.ts`
interface, the `providers/` adapters, the `webhook/` ingestion pipeline, and the
reconciliation cron). Coordinate with `security-auditor` (HMAC verification,
timing-safe compare, replay window, token-at-rest encryption — the
`security-review` skill runs before merge).

## Mission

The existing `server/src/modules/billing/` is **Stripe-only**: `stripe.client.ts`
(`getStripe`, `isStripeConfigured`), `billing.controller/service/routes/schema/
test.ts`, and `index.ts` exporting `billingRouter`, `handleStripeWebhook`,
`createSubscriptionForUser`. Per `IDEA.md` §3 and build-phase 4, refactor this
**behind a provider abstraction** and stand up Polar as the active provider:

1. An `IPaymentProvider` interface; Stripe logic moved behind it (inactive);
   Polar implemented as a **fetch-based REST client** (no `@polar-sh/sdk`).
2. A **verify-before-parse** webhook subsystem (Standard Webhooks HMAC-SHA256)
   with idempotent ingestion: verify → dedupe → dispatch → persist.
3. Provider-neutral Mongoose models (`Subscription`, `Customer`, `Order`,
   `WebhookEvent`) that the entitlement gate (prompt 07) reads.
4. A **reconciliation cron** that polls Polar to heal drift from dropped webhooks.

Mirror the pulsy references: `/home/serverlessbase/pulsy/apps/server/src/{services/
polar.ts, payments/providers/polar.ts, webhooks/handlers/polar-handler.ts,
webhooks/webhook-router.ts}`.

## Operating Constraints

| Rule | Detail |
|---|---|
| Verify-before-parse | Validate the signature on the **raw bytes** before any `JSON.parse`. Failed signature → `401`, body never parsed. Mirror pulsy `polar-handler.ts`. |
| Standard Webhooks | `signed_content = "{id}.{timestamp}.{rawBody}"`; `HMAC-SHA256(secret, signed_content)`; **strict base64** digest; `crypto.timingSafeEqual` constant-time compare against the `webhook-signature` header. Reject non-round-tripping base64. |
| Replay window | Reject when `|now − webhook-timestamp| > 5 min`. |
| Raw body mount order | `app.ts` currently applies `express.json({limit:'1mb'})` globally. Mount `POST /api/billing/webhook` with `express.raw({ type: '*/*' })` **before** the global JSON parser so the webhook handler receives the unparsed buffer. Document the precedence. |
| Idempotency | INSERT-first against `WebhookEvent` UNIQUE `(provider, eventId)`. Duplicate delivery short-circuits to `200` with the stored status — **no re-dispatch**. |
| Token at rest | Encrypt `POLAR_ACCESS_TOKEN` (and any persisted secret) with the crypto helper from prompt 02 (`server/src/shared/crypto/` `encryptSecret`/`decryptSecret`, AES-256-GCM via `MASTER_ENCRYPTION_KEY`). Decrypt only in-process at call time; never log or return it. |
| Boundary discipline | The access token and secrets **never leave the server**. The client receives only redirect URLs and non-sensitive state. |
| No SDK | `providers/polar.ts` is `fetch`-based. Sandbox vs prod base URL from `POLAR_SERVER`; bearer `POLAR_ACCESS_TOKEN`; optional `Idempotency-Key` request header; parse `Retry-After` for backoff. Injectable REST client for tests. |
| Env from root | All vars (`PAYMENT_PROVIDER`, `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_SERVER`, `POLAR_PRO_PRODUCT_ID`, `POLAR_BUSINESS_PRODUCT_ID`) are zod-validated in `server/src/config/env.ts` (added by prompt 02). No subdirectory `.env`. See `.claude/rules/environment-variables.md`. |
| Typed schemas | Every model uses `InferSchemaType`, type exported beside the model, explicit `{ timestamps: true }`, enum literal unions. See `.claude/rules/mern-mongoose-typed-schemas.md`. |
| Named exports | No `export default` on interface, providers, models, services, router. See `.claude/rules/mern-no-default-exports.md`. |
| Excluded | No client UI here (prompt 07 owns the pricing grid + billing page); no entitlement matrix here (prompt 07 owns `plans.ts`); no tax engine (Polar is Merchant-of-Record). |

## Phases

### Phase 0 — Map the model
- 0.1 Read `server/src/modules/billing/`: `stripe.client.ts`
  (`getStripe`/`isStripeConfigured`), `billing.controller.ts`,
  `billing.service.ts`, `billing.routes.ts`, `billing.schema.ts`, and `index.ts`
  (`billingRouter`, `handleStripeWebhook`, `createSubscriptionForUser`) — know
  exactly what moves behind the interface.
- 0.2 Read `server/src/modules/users/users.model.ts` to find the current Stripe
  blob that must become provider-neutral `customer`/`subscription` refs.
- 0.3 Read `server/src/app.ts` (`createApp()` middleware order:
  `requestId → pinoHttp → express.json({limit:'1mb'}) → cors → passport.initialize()
  → route mounts → notFound → errorHandler`) to place the raw webhook route ahead
  of `express.json`.
- 0.4 Read `server/src/config/env.ts` (the `Env`/`env` zod shape, with the prompt-02
  Polar vars) and `server/src/shared/crypto/` (`encryptSecret`/`decryptSecret`).
- 0.5 Read the pulsy references listed in the Mission for the REST client factory,
  provider impl (checkout/portal/changePlan), signature verification, and the
  verify→dedupe→dispatch→persist router.

### Phase 1 — Models (typed, `InferSchemaType`)
New files in `server/src/modules/billing/`:
- 1.1 `customer.model.ts` — `Customer` { userId (fk), provider ('polar'|'stripe'),
  providerCustomerId (unique per provider), email, createdAt/updatedAt }.
- 1.2 `subscription.model.ts` — `Subscription` { userId, customerId,
  provider, providerSubscriptionId (unique), productId, planSlug
  ('free'|'pro'|'business'), status ('active'|'past_due'|'canceled'|'revoked'),
  cancelAtPeriodEnd (bool), currentPeriodEnd (Date), `{ timestamps: true }` }.
- 1.3 `order.model.ts` — `Order` { userId, provider, providerOrderId (unique),
  subscriptionId, amount, currency, status ('paid'|'refunded'), createdAt }.
- 1.4 `webhook-event.model.ts` — `WebhookEvent` { provider, eventId,
  type, status ('pending'|'processed'|'failed'|'skipped'), retryCount,
  payloadHash, error } with a **compound UNIQUE index `(provider, eventId)`**.
- 1.5 Update `users.model.ts`: replace the Stripe blob with `customer` /
  `subscription` ObjectId refs (provider-neutral). Migrate-by-tolerance (read old
  shape if present); document the field change.

### Phase 2 — Provider abstraction
- 2.1 `payment-provider.ts` — `IPaymentProvider` with `createCheckout(input)`,
  `openPortal(input)`, `changePlan(input)`, `verifyWebhook(rawBody, headers)`,
  `parseEvent(rawBody)`. Provider-neutral DTOs (no Stripe/Polar types leak).
- 2.2 `providers/polar.ts` — fetch-based REST client: base URL from `POLAR_SERVER`
  (sandbox/prod), bearer from decrypted `POLAR_ACCESS_TOKEN`, optional
  `Idempotency-Key` header, `Retry-After` backoff parsing, typed responses.
  `verifyWebhook` does the Standard Webhooks HMAC + replay check. **Injectable**
  inner `fetch`/REST client so tests mock it.
- 2.3 `providers/stripe.ts` — existing Stripe logic from `stripe.client.ts` +
  `billing.service.ts` moved behind `IPaymentProvider`, **inactive** (kept for
  multi-provider capability). Do not delete Stripe code.
- 2.4 `active-provider.ts` — factory selecting the provider via the
  `PAYMENT_PROVIDER` env var; default `polar`. Single export `getPaymentProvider()`.

### Phase 3 — Webhook ingestion pipeline
New `server/src/modules/billing/webhook/`:
- 3.1 `verify.ts` — `verifyPolarSignature(rawBody, headers)`: assemble
  signed-content, HMAC-SHA256, strict-base64 decode, `timingSafeEqual`, ±5min
  replay reject. Returns the verified-but-unparsed buffer.
- 3.2 `ingest.ts` — pipeline `verify → dedupe → dispatch → persist`:
  INSERT `WebhookEvent` as `pending` (UNIQUE guard); on duplicate-key short-circuit
  to `200` with stored status (no re-dispatch); else `parseEvent`, dispatch, mark
  `processed`/`failed`/`skipped`, bump `retryCount` on failure.
- 3.3 `registry.ts` — event-type → handler dispatch upserting models:
  - `subscription.created` / `.updated` / `.active` → upsert `Subscription` by
    `providerSubscriptionId`, link `Customer`, set `status='active'`.
  - `subscription.canceled` / `.revoked` → mark `canceled` /
    `cancelAtPeriodEnd`.
  - `order.created` / `.paid` / `.refunded` → upsert `Order`.
  - Unhandled types → mark `skipped` (no error).
- 3.4 Resolve plan from `productId` via prompt-07 `polar-config.ts`
  `getPlanForProductId` (product_id is source of truth, not checkout metadata).

### Phase 4 — Routes & wiring
- 4.1 `billing.routes.ts` — keep authenticated billing routes; the **webhook** is
  registered separately in `app.ts` with `express.raw({ type: '*/*' })` **before**
  `express.json`. Response codes: `200` already-processed / `200` newly-processed /
  `401` bad signature.
- 4.2 In `app.ts`, mount the raw webhook route ahead of the global JSON parser;
  keep the rest of the middleware order intact.
- 4.3 `index.ts` — export `billingRouter`, `getPaymentProvider`, the webhook
  handler, and the models' public API; drop the Stripe-specific
  `handleStripeWebhook` export in favor of the provider-neutral handler (note the
  breaking change).

### Phase 5 — Reconciliation cron
- 5.1 `reconcile.ts` — `reconcileSubscriptions()`: poll Polar's active
  subscriptions via `providers/polar.ts`, compare against local `Subscription`
  rows, heal drift (status, `currentPeriodEnd`, `cancelAtPeriodEnd`) from
  dropped/missed webhooks. One failing record must not abort the loop (log +
  continue). Wrap each external call behind the injectable REST client.
- 5.2 Register on a schedule (reuse the project scheduler; one job, cancelled on
  shutdown). Idempotent: re-running heals to the same state, never creates rows
  Polar doesn't have.

### Tests
Server (`server/`, vitest, `fileParallelism:false`, v8 coverage, supertest against
`createApp()`, `startMemoryMongo`/`stopMemoryMongo`/`clearCollections` from
`server/src/shared/testing/mongo.ts`): **100% coverage** (lines/branches/functions/
statements). Inject a **mocked Polar REST client**; drive the webhook pipeline
end-to-end against **signed fixtures**.
- Signature matrix (mirror pulsy, all **before** parse): valid signature passes;
  tampered body → `401`; wrong secret → `401`; timestamp outside ±5min → `401`;
  malformed/non-round-tripping base64 → reject.
- Idempotency: same `eventId` twice → processed once, second returns stored status
  `200`, no second dispatch; `retryCount` increments only on handler failure.
- Dispatch: `subscription.active` upserts an active `Subscription` + linked
  `Customer`; `subscription.canceled` sets canceled; `order.refunded` upserts a
  refunded `Order`; unhandled type → `skipped`, no error row.
- Provider abstraction: `active-provider.ts` returns Polar when
  `PAYMENT_PROVIDER=polar`, Stripe when `stripe`; Stripe adapter conforms to
  `IPaymentProvider`.
- Reconciliation: a local row drifted from Polar is healed; a throwing record does
  not abort the loop (the next record still reconciles); no phantom rows created.
- Token at rest: persisted `POLAR_ACCESS_TOKEN` is encrypted (ciphertext ≠
  plaintext); decrypt round-trips; never appears in logs/responses.
- Raw-body route: the global JSON parser does not consume the webhook path.

### i18n
7 locales — **en, ar, fr, de, es, ru, zh** — with auto-detect + RTL (`ar`), via
the prompt-01 server `t(key, vars)` + `req.language`. Webhook **responses** are
machine-facing (status codes/JSON) and not localized, but any **operator/API error
returned to an authenticated billing caller** (e.g. checkout/portal failures) is
localized server-side through `t()`; no hardcoded English user-facing strings.
Extend the key-parity test so the billing error keys exist in all 7 langs with
identical placeholders.

### Documentation
- `/docs`: a "Polar billing & webhooks" page (the webhook URL, secret, replay
  window, idempotency, reconciliation). User-facing → authored in all 7 locales
  once `01-*` is merged.
- `ARCHITECTURE.md`: the provider abstraction, the four new models, the webhook
  route + mount order, the reconciliation cron.
- `.env.example`: document `PAYMENT_PROVIDER`, `POLAR_*`, and the `MASTER_
  ENCRYPTION_KEY` dependency (sectioned, root-only). `CHANGELOG.md` entry noting
  the Stripe-behind-interface refactor + provider-neutral `User` fields.

## Agents & Skills

- **Agents:** `backend-dev` (primary — interface, providers, webhook pipeline,
  models, cron); `security-auditor` (HMAC, timing-safe compare, replay, token
  encryption review).
- **Skills:** `payment-orchestrator` (provider-abstraction + Polar conventions);
  `security-review` (**required** pass on the webhook verification + secret
  handling before merge); `code-review` (final pass); `verify` (drive a signed
  webhook fixture + a reconciliation run end-to-end).

## Idempotency Contract

Re-running MUST NOT: register the raw webhook route twice, duplicate any model or
its `(provider, eventId)` index, re-apply the Stripe-behind-interface refactor,
re-add provider-neutral fields already on `User`, schedule a second reconciliation
job, or stack the JSON-parser precedence change. Detect already-migrated state and
converge — webhook delivery is idempotent by the `(provider, eventId)` unique
guard, and reconciliation heals to the same final state on every run.
