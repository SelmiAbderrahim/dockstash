# Polar Webhooks Subsystem — Build Prompt

> **Standard-Webhooks ingestion** — HMAC-SHA256 verification before parse, idempotent processing, Express raw-body route.

---

## Agent

`polar-integration`. Read `polar-api/references/webhooks.md` and the webhook
section of `polar-provider/references/integration-checklist.md`.

## Mission

Port `apps/server/src/webhooks/` from password-manager and wire an Express
raw-body route `POST /api/webhooks/payment/polar`. Webhooks drive subscription
state changes that the entitlement gate (prompt 04/05) reads.

## Operating Constraints

| Rule | Detail |
|---|---|
| Verify-before-parse | Validate the signature **before** `JSON.parse`. A failed signature returns 401 and the body is never parsed. |
| Standard Webhooks | HMAC-SHA256 over `webhook-id.webhook-timestamp.rawBody`; base64 digest; `crypto.timingSafeEqual` constant-time compare. |
| Replay window | Reject timestamps outside ±5 minutes. |
| Idempotency | Dedupe on `webhook-id` via INSERT-first against `webhookEvent` UNIQUE (provider, eventId) from prompt 01. |
| Raw body | Express route must receive the **unparsed** body (`express.raw`), mirroring password-manager's `bodyParser:false` Next.js route. |
| Secret source | `POLAR_WEBHOOK_SECRET` server-only from root `.env`. |

## Phases

### Phase 0 — Study the model
Read password-manager `webhooks/handlers/polar-handler.ts`, `webhook-router.ts`,
`normalizers/polar-normalizer.ts`, `handlers/registry.ts`, `webhooks/types.ts`,
and the Next.js route `apps/pssmngr/pages/api/webhooks/payment/[provider].ts`.

### Phase 1 — Handlers + router
1.1 `handlers/polar-handler.ts` — `verifyPolarWebhook(rawBody, signature, headers)`
(signed-content assembly, timing-safe compare, replay tolerance),
`parsePolarEvent()` (only after verify), `derivePolarEventId()`.
1.2 `normalizers/polar-normalizer.ts` — `normalizePolarEvent()`,
`isPolarEventSupported()`, envelope type.
1.3 `handlers/registry.ts` — event-type → handler dispatch; handlers update
`subscription` rows on checkout/subscription/cancellation events.
1.4 `webhook-router.ts` — `handlePaymentWebhook(provider, rawBody, signature,
headers)`: verify → idempotent insert → normalize → dispatch.

### Phase 2 — Express route
Register `POST /api/webhooks/payment/polar` in `apps/server/src/index.ts` using
`express.raw({ type: '*/*' })` for that path only (must precede any global JSON
body parser). Pass the raw buffer + signature header to `handlePaymentWebhook`.
Response codes: 200 already-processed / 200 newly-processed / 202 enqueued /
401 bad signature.

### Phase 3 — Ingestion + retry
Persist every event to `webhookEvent`; on processing failure set
`status='failed'` + `retryCount`; on replay return the stored status (no
re-dispatch).

### Tests
- Signature: valid passes; tampered body fails; wrong secret fails; timestamp
  outside ±5min fails — all **before** any parse.
- Idempotency: same `webhook-id` twice processes once; second returns stored status.
- Dispatch: a `subscription.active` event flips the `subscription` row to active;
  `subscription.canceled` sets canceled.
- Raw-body route: JSON body parser does not consume the webhook path.
- 100% coverage of `webhooks/`. Docker-only (`pulsy-server`).

### i18n
- Webhook responses are machine-facing (status codes/JSON), not localized. Any
  operator-facing log lines stay English.

### Documentation
- Webhook route + secret documented in `docs/self-hosting/polar.md` (prompt 10).

### Agents & Skills
- Agent: `polar-integration`. Skill: `polar-api` (webhook scheme), `polar-provider`.

## Idempotency Contract

Re-running MUST NOT register the Express route twice or duplicate handlers.
Reconcile route registration in place.
