# Webhook Event Patterns

## Signature Verification

### Stripe Signature Verification

```typescript
import Stripe from "stripe";

function verifyStripeWebhook(
  payload: string,
  signature: string,
  secret: string
): Stripe.Event {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  return stripe.webhooks.constructEvent(payload, signature, secret);
}
```

Header: `stripe-signature`
Algorithm: HMAC-SHA256 with timestamp

### Moyasar Signature Verification

```typescript
import crypto from "crypto";

function verifyMoyasarWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSignature, "hex")
  );
}
```

Header: `x-moyasar-signature`
Algorithm: HMAC-SHA256

### LemonSqueezy Signature Verification

```typescript
import crypto from "crypto";

function verifyLemonSqueezyWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSignature, "hex")
  );
}
```

Header: `x-signature`
Algorithm: HMAC-SHA256

---

## Event Type Mapping

### Unified Event Types

| Unified Type | Stripe | Moyasar | LemonSqueezy |
|--------------|--------|---------|--------------|
| `CHECKOUT_COMPLETED` | `checkout.session.completed` | `invoice.paid` | `order_created` |
| `PAYMENT_SUCCEEDED` | `payment_intent.succeeded` | `payment.paid` | `order_created` |
| `PAYMENT_FAILED` | `payment_intent.payment_failed` | `payment.failed` | - |
| `SUBSCRIPTION_CREATED` | `customer.subscription.created` | - | `subscription_created` |
| `SUBSCRIPTION_UPDATED` | `customer.subscription.updated` | - | `subscription_updated` |
| `SUBSCRIPTION_CANCELED` | `customer.subscription.deleted` | - | `subscription_cancelled` |
| `INVOICE_PAID` | `invoice.paid` | `invoice.paid` | - |

---

## Webhook Handler Patterns

### Base Handler Structure

```typescript
interface WebhookHandler {
  provider: PaymentProvider;
  processEvent(event: WebhookEvent): Promise<WebhookResult>;
}

interface WebhookResult {
  success: boolean;
  eventId: string;
  message: string;
  data?: Record<string, unknown>;
}

abstract class BaseWebhookHandler implements WebhookHandler {
  abstract provider: PaymentProvider;

  async processEvent(event: WebhookEvent): Promise<WebhookResult> {
    const startTime = Date.now();

    const { processed, duplicate } = await this.checkIdempotency(event.id);
    if (duplicate) {
      return {
        success: true,
        eventId: event.id,
        message: "Event already processed (idempotent)",
      };
    }

    try {
      const result = await this.handleEvent(event);
      await this.markProcessed(event.id, Date.now() - startTime);
      return result;
    } catch (error) {
      await this.markFailed(event.id, error);
      throw error;
    }
  }

  protected abstract handleEvent(event: WebhookEvent): Promise<WebhookResult>;

  private async checkIdempotency(eventId: string): Promise<{
    processed: boolean;
    duplicate: boolean;
  }> {
    // Implementation
  }

  private async markProcessed(eventId: string, durationMs: number): Promise<void> {
    // Implementation
  }

  private async markFailed(eventId: string, error: unknown): Promise<void> {
    // Implementation
  }
}
```

### Event Router

```typescript
class WebhookEventRouter {
  private handlers: Map<PaymentProvider, WebhookHandler> = new Map();

  register(handler: WebhookHandler): void {
    this.handlers.set(handler.provider, handler);
  }

  async route(
    provider: PaymentProvider,
    payload: string,
    signature: string
  ): Promise<WebhookResult> {
    const handler = this.handlers.get(provider);
    if (!handler) {
      throw new Error(`No handler registered for provider: ${provider}`);
    }

    const verification = this.verifySignature(provider, payload, signature);
    if (!verification.isValid) {
      throw new Error(`Invalid webhook signature: ${verification.error}`);
    }

    return handler.processEvent(verification.event!);
  }

  private verifySignature(
    provider: PaymentProvider,
    payload: string,
    signature: string
  ): WebhookVerificationResult {
    const providerInstance = PaymentProviderFactory.get(provider);
    return providerInstance.verifyWebhook(payload, signature);
  }
}
```

---

## Subscription Lifecycle Events

### Creation Flow

```
checkout.session.completed
         |
         v
customer.subscription.created
         |
         v
invoice.created
         |
         v
invoice.paid
         |
         v
Subscription Active
```

### Renewal Flow

```
invoice.upcoming (3 days before)
         |
         v
invoice.created
         |
         v
payment_intent.succeeded
         |
         v
invoice.paid
         |
         v
customer.subscription.updated
```

### Cancellation Flow

```
User requests cancel
         |
         v
customer.subscription.updated
(cancel_at_period_end = true)
         |
         v
[Period ends]
         |
         v
customer.subscription.deleted
```

### Payment Failure Flow

```
invoice.payment_failed
         |
         v
customer.subscription.updated
(status = past_due)
         |
         v
[Retry attempts]
         |
         +-- Success -> invoice.paid
         |
         +-- All retries fail
                |
                v
     customer.subscription.deleted
```

---

## Webhook Endpoint Implementation

### Express Handler

```typescript
app.post(
  "/api/webhooks/:provider",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const provider = req.params.provider as PaymentProvider;
    const signature = getSignatureHeader(req, provider);

    try {
      const result = await webhookRouter.route(
        provider,
        req.body.toString(),
        signature
      );

      res.status(200).json(result);
    } catch (error) {
      console.error(`Webhook error for ${provider}:`, error);

      if (error.message.includes("signature")) {
        res.status(401).json({ error: "Invalid signature" });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }
);

function getSignatureHeader(req: Request, provider: PaymentProvider): string {
  const headers: Record<PaymentProvider, string> = {
    [PaymentProvider.STRIPE]: "stripe-signature",
    [PaymentProvider.MOYASAR]: "x-moyasar-signature",
    [PaymentProvider.LEMON_SQUEEZY]: "x-signature",
  };

  return req.headers[headers[provider]] as string || "";
}
```

### tRPC Handler (for internal testing)

```typescript
export const webhookRouter = createTRPCRouter({
  processTestWebhook: adminProcedure
    .input(z.object({
      provider: z.nativeEnum(PaymentProvider),
      eventType: z.nativeEnum(WebhookEventType),
      data: z.record(z.unknown()),
    }))
    .mutation(async ({ input }) => {
      if (process.env.NODE_ENV === "production") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Test webhooks not allowed in production",
        });
      }

      const event: WebhookEvent = {
        id: `test_${nanoid()}`,
        provider: input.provider,
        type: input.eventType,
        livemode: false,
        data: { object: input.data },
        createdAt: new Date(),
        rawPayload: JSON.stringify(input.data),
      };

      const handler = getWebhookHandler(input.provider);
      return handler.processEvent(event);
    }),
});
```

---

## Best Practices

### Always Return 200 Quickly

Webhook endpoints must respond within 30 seconds. Process asynchronously if needed:

```typescript
app.post("/webhooks/stripe", async (req, res) => {
  const event = verifyAndParse(req);

  await queueForProcessing(event);

  res.status(200).json({ received: true });
});

async function queueForProcessing(event: WebhookEvent): Promise<void> {
  await db.insert(webhookQueue).values({
    id: nanoid(),
    event: event,
    status: "pending",
    createdAt: new Date(),
  });
}
```

### Handle Duplicate Events

Providers may send the same event multiple times:

```typescript
async function isEventProcessed(eventId: string): Promise<boolean> {
  const existing = await db.query.webhookEvents.findFirst({
    where: and(
      eq(webhookEvents.eventId, eventId),
      eq(webhookEvents.status, "processed")
    ),
  });

  return !!existing;
}
```

### Log Everything

```typescript
async function processWithLogging(
  event: WebhookEvent
): Promise<WebhookResult> {
  console.log(`[Webhook] Received ${event.type} from ${event.provider}`, {
    eventId: event.id,
    livemode: event.livemode,
  });

  try {
    const result = await processEvent(event);

    console.log(`[Webhook] Processed ${event.id} successfully`, {
      duration: result.durationMs,
    });

    return result;
  } catch (error) {
    console.error(`[Webhook] Failed to process ${event.id}`, {
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}
```

### Implement Retry Logic for Failed Processing

```typescript
const RETRY_DELAYS = [60, 300, 900, 3600, 86400];

async function scheduleRetry(
  eventId: string,
  retryCount: number
): Promise<void> {
  if (retryCount >= RETRY_DELAYS.length) {
    await markAsPermanentlyFailed(eventId);
    await alertOperations(eventId);
    return;
  }

  const delaySeconds = RETRY_DELAYS[retryCount];
  const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);

  await db.update(webhookEvents)
    .set({
      status: "pending_retry",
      retryCount: retryCount + 1,
      nextRetryAt,
    })
    .where(eq(webhookEvents.id, eventId));
}
```
