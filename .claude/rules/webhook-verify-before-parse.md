# Webhook Verify-Before-Parse (Surface #4) - Strict Rule

## MANDATORY REQUIREMENT - ZERO TOLERANCE

**Every payment-provider webhook verifies the HMAC signature over the RAW
request bytes BEFORE `JSON.parse`. Signature comparison uses
`crypto.timingSafeEqual`, never `===`/`==`. Missing / empty webhook secret
FAILS CLOSED (throws). Duplicate deliveries are absorbed by a `(provider,
eventId)` unique index — never a bare "check the DB then insert". Rate
limiting runs BEFORE `express.raw()` so a forged-signature flood cannot burn
signature math AND cannot consume the bytes the HMAC is computed over.**

See `prompts/dockstash-security/04-webhook-payment-integrity-polar-opus-4.7.md`
and `docs/polar-billing-and-webhooks.en.md` for the threat model.

## Why This Rule Exists

Five distinct failure modes this rule blocks in a single pattern:

1. **Parse-before-verify.** If `JSON.parse` runs on unverified bytes, an
   attacker feeds arbitrary JSON to downstream handlers that trust the
   envelope. Grant/refund/cancel lifecycle transitions apply on forged input.
2. **`===` on a signature.** String equality leaks the first-differing byte
   through wall-clock timing. Repeated probes reconstruct the expected HMAC.
   `timingSafeEqual` flattens the timing curve.
3. **Skip-on-missing-secret.** A handler that no-ops verification when the
   env var is empty is a Critical finding — an operator who forgets to
   configure the webhook secret ships an anyone-can-grant-subscription
   endpoint. Fail closed always.
4. **Replay of a stolen delivery.** Without a timestamp-tolerance window +
   an `(provider, eventId)` unique guard, a captured delivery can be
   re-submitted to double-grant. The window narrows the replay slot to
   minutes; the DB guard closes even that slot.
5. **Rate-limit-after-raw.** If the limiter sits AFTER `express.raw()`, a
   flood consumes the body-parsing budget before the limiter engages. If it
   sits BEFORE and the limiter reads/alters the body, the HMAC is computed
   over different bytes than were signed → every real delivery 401s.

## CORRECT

```ts
// verify runs BEFORE parse — the buffer is unverified JSON until this returns
verifyWebhook(rawBody: Buffer, headers: WebhookHeaders): void {
  const secret = this.options.getWebhookSecret();
  if (!secret) {
    throw new WebhookVerifyError('POLAR_WEBHOOK_SECRET is not configured', 500);
  }
  const id = pickHeader(headers, 'webhook-id');
  const ts = pickHeader(headers, 'webhook-timestamp');
  const sigHeader = pickHeader(headers, 'webhook-signature');
  if (!id || !ts || !sigHeader) {
    throw new WebhookVerifyError('missing standard-webhooks headers', 401);
  }
  const tsSeconds = Number(ts);
  if (!Number.isFinite(tsSeconds)) {
    throw new WebhookVerifyError('webhook-timestamp is not a number', 401);
  }
  const now = this.options.nowSeconds();
  if (Math.abs(now - tsSeconds) > REPLAY_TOLERANCE_SECONDS) {
    throw new WebhookVerifyError('webhook-timestamp outside replay window', 401);
  }
  const signedContent = `${id}.${ts}.${rawBody.toString('utf8')}`;
  const expected = createHmac('sha256', decodeStandardWebhookSecret(secret))
    .update(signedContent, 'utf8')
    .digest();
  for (const part of sigHeader.split(' ')) {
    const [scheme, value] = part.split(',');
    if (scheme !== 'v1' || !value) continue;
    const candidate = decodeBase64Strict(value);
    if (!candidate) continue;
    if (candidate.length !== expected.length) continue;
    if (timingSafeEqual(candidate, expected)) return;   // constant-time compare
  }
  throw new WebhookVerifyError('signature mismatch', 401);
}
```

```ts
// ingest — verify BEFORE parseEvent; parse only after verify returns
provider.verifyWebhook(rawBody, headers);          // throws on any failure mode
const parsed = provider.parseEvent(rawBody, headers);
// INSERT-first idempotency: the (provider, eventId) unique guard is the
// atomic dedup — never a countDocuments()/find()-then-create race.
try {
  await WebhookEvent.create({ provider: provider.name, eventId: parsed.eventId, ... });
} catch (err) {
  if (isDuplicateKeyError(err)) return ackReplayWithoutReDispatch(parsed);
  throw err;
}
```

```ts
// app.ts — rate limiter BEFORE express.raw(), raw route BEFORE express.json()
app.post(
  '/api/billing/webhook',
  createWebhookRateLimiter(),
  express.raw({ type: '*/*', limit: '1mb' }),
  webhookHandler,
);
app.use(express.json({ limit: '1mb' }));   // AFTER the webhook mount
```

## FORBIDDEN

```ts
// WRONG — parse before verify. Unverified JSON reaches the dispatcher.
const event = JSON.parse(rawBody.toString());
provider.verifyWebhook(rawBody, headers);   // too late

// WRONG — string equality on a signature. Timing side channel.
if (expectedSig === providedSig) return;
if (sig !== computedSig) throw ...;

// WRONG — skip-on-missing-secret. Fail CLOSED, never open.
if (!secret) return;                         // silently accepts every event
if (!secret) return true;                    // same failure mode

// WRONG — bare countDocuments()+create. TOCTOU: two concurrent replays both
// pass the read and both grant. Use the unique index + insert-first pattern.
const existing = await WebhookEvent.findOne({ eventId });
if (!existing) await WebhookEvent.create({ eventId });

// WRONG — silent hard delete on refund/cancel. Post linked state instead so
// the lifecycle history is auditable.
await Order.deleteOne({ providerOrderId });

// WRONG — client-supplied money. Amounts come from the verified event
// payload + tier catalog, never req.body.amount.
const order = await Order.create({ amount: req.body.amount });

// WRONG — express.raw before the rate limiter. A forged-signature flood
// consumes body-parsing budget before the limiter engages.
app.post('/api/billing/webhook', express.raw(...), createWebhookRateLimiter(), h);

// WRONG — global express.json() mounted before the raw-body webhook route.
// The dispatcher sees a parsed object; the HMAC was signed over bytes; every
// real delivery 401s.
app.use(express.json());
app.post('/api/billing/webhook', express.raw(...), webhookHandler);
```

## Contract

For every webhook ingest surface:

1. **Verify BEFORE parse.** `verify(rawBody, headers)` runs FIRST. `parse`
   runs AFTER — the same raw buffer, never a pre-parsed object.
2. **Fail closed on missing secret.** An empty / undefined secret throws
   `WebhookVerifyError`. Never a silent no-op.
3. **Constant-time compare.** Signature buffers are equal-length-guarded
   THEN compared with `crypto.timingSafeEqual`. Never `===`/`==`.
4. **Replay window.** `webhook-timestamp` outside `REPLAY_TOLERANCE_SECONDS`
   (default 300s) rejects.
5. **Insert-first idempotency.** `(provider, eventId)` is a unique index
   on `WebhookEvent`; the ingest INSERTs first and treats a duplicate-key
   error as "already processed → ack with the stored status". Never a
   countDocuments()/find()-then-create race.
6. **Linked state on refund/cancel.** Refunds/cancellations post a linked
   record (`Order.status = 'refunded'`, a linked cancellation row). Never a
   hard delete of the original order/subscription.
7. **Server-derived money.** `amount` / `currency` / `productId` come from
   the verified payload + tier catalog, never `req.body`.
8. **Mount order.** In `app.ts`, the order is: `createWebhookRateLimiter()`
   → `express.raw({ type: '*/*' })` → `webhookHandler` → (later)
   `app.use(express.json())`. The limiter is a header-only bucket and does
   NOT consume the request body.

## Escape Hatch

None. A payment-webhook handler with any of the above regressions is a
Critical finding, not a judgment call.

## Validation

```bash
# Static guards for this surface — all green:
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm \
  npx vitest run src/modules/billing/webhook/webhook-verify-meta.test.ts

# Full webhook + provider suite — verify/parse/replay/idempotency covered:
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm \
  npx vitest run src/modules/billing/webhook-dispatch.test.ts \
                 src/modules/billing/billing.test.ts \
                 src/modules/billing/providers/polar-extra.test.ts

# ESLint ban catches `===` on a *sig*/*signature*/*hmac*/*digest* identifier:
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm run lint
```

## Checklist

- [ ] `verify(rawBody, headers)` runs BEFORE any `parseEvent` / `JSON.parse`.
- [ ] Signature compared with `crypto.timingSafeEqual`, length-guarded first.
- [ ] Missing / empty secret throws — never a silent no-op.
- [ ] `webhook-timestamp` outside the tolerance window rejects.
- [ ] `WebhookEvent` has the unique `(provider, eventId)` index and the
      ingest uses INSERT-first duplicate-key ack.
- [ ] Refunds/cancellations post linked state; no `Order.deleteOne(...)`.
- [ ] Amounts/currency/productId come from the verified payload, never
      `req.body`.
- [ ] `app.ts` mount order: rate limiter → `express.raw` → handler; global
      `express.json()` is registered AFTER the webhook route.
- [ ] `webhook-verify-meta.test.ts` and the eslint ban stay green.
