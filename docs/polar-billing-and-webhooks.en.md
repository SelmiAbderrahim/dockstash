# Polar billing & webhooks

Dockstash runs Polar as the active payment provider behind a provider-neutral
interface. The Stripe adapter is kept in the codebase but is inactive by default.

## Endpoints

- `POST /api/billing/checkout` (auth) — start a hosted-checkout session.
- `GET  /api/billing/portal` (auth) — open a hosted customer portal.
- `POST /api/billing/change-plan` (auth) — switch the active subscription's product.
- `POST /api/billing/webhook` — Polar deliveries. Verify-before-parse.

## Webhook URL

Configure `https://<your-server>/api/billing/webhook` in the Polar dashboard.

## Standard Webhooks signature

Dockstash verifies each delivery using the [Standard Webhooks](https://standardwebhooks.com)
scheme:

- `signed_content = "{webhook-id}.{webhook-timestamp}.{rawBody}"`
- `signature      = base64(HMAC-SHA256(secret, signed_content))`
- Header: `webhook-signature: v1,<sig> [v1,<sig> ...]`
- Timestamps outside ±5 minutes are rejected.

The check runs on the raw request bytes; the body is never `JSON.parse`d until
the signature passes.

## Idempotency

Every delivery is INSERT'd into the `webhook_event` collection with a unique
`(provider, eventId)` guard. Duplicate deliveries short-circuit to `200` with
the stored status — no handler is dispatched twice. On handler failure the row
flips to `failed` and `retryCount` increments; Polar retries with backoff.

## Reconciliation

`reconcileSubscriptions()` runs every 15 minutes. It polls Polar's active
subscriptions and heals drift on local `Subscription` rows (status,
`currentPeriodEnd`, `cancelAtPeriodEnd`). It never creates rows Polar does not
report, and one failing record does not abort the loop.

A subscription that has fully ended drops out of Polar's `?active=true`
listing, so the poll above would never revisit it — a dropped terminal webhook
(`subscription.canceled` / `.revoked`) could otherwise leave paid entitlements
live indefinitely. A second pass therefore re-fetches every local `active` /
`past_due` row that the active listing did not report, via
`provider.getSubscription(id)`. A `404` (Polar no longer knows the id) heals the
row to `canceled` + Free; any other terminal status heals through the same
path. (prompt 13 / F4)

## Free-landing transitions

Every path that lands a subscriber on Free — grace expiry, refund/chargeback,
a plan downgrade, AND a **direct** `subscription.canceled` / `.revoked` webhook
— funnels through `applyProjectCap(userId, 'free', { priorSlug })`. That pauses
(never deletes) over-cap projects, disables their schedules, re-asserts the
fleet-agent cap, and — when the prior tier retained for longer — stamps a
retention grandfather window so a downgrade does not retroactively prune
pre-downgrade snapshots. Earlier, a direct cancel/revoke skipped this entirely
and every subsequent backup 403'd with no project flagged. (prompt 13 / F2)

## Environment

| Variable | Purpose |
|---|---|
| `PAYMENT_PROVIDER` | `none` / `polar` / `stripe`. Default `none`. |
| `POLAR_ACCESS_TOKEN` | Server-only. Encrypted at rest with `MASTER_ENCRYPTION_KEY`. |
| `POLAR_WEBHOOK_SECRET` | Standard Webhooks secret. `whsec_…` accepted. |
| `POLAR_SERVER` | `sandbox` (default) or `production`. |
| `POLAR_PRO_PRODUCT_ID` | Product id → `pro` plan slug. |
| `POLAR_BUSINESS_PRODUCT_ID` | Product id → `business` plan slug. |
