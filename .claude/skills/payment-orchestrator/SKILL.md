---
name: payment-orchestrator
description: Multi-provider payment orchestration skill for ServerlessBase. Handles provider selection, payment flow coordination, webhook processing, error recovery, and testing. Use when implementing payment features, debugging payment issues, creating checkout flows, or writing payment integration tests.
license: MIT
metadata:
  version: "1.0"
  author: "ServerlessBase Team"
  category: "payment"
  project: "serverlessbase"
  providers: "stripe,moyasar,lemonsqueezy"
---

# Payment Orchestrator Skill

## Overview

**Comprehensive multi-provider payment orchestration** for ServerlessBase. This skill enables intelligent coordination across Stripe (Global), Moyasar (MENA), and LemonSqueezy (EU VAT) payment providers.

**Keywords**: payment integration, multi-provider, stripe, moyasar, lemonsqueezy, checkout, webhook, subscription, billing, region routing, payment testing, SaaS payments

## When to Use This Skill

- **Payment Integration**: Implementing new checkout flows, subscription management
- **Provider Selection**: Determining which provider to use based on region/requirements
- **Webhook Handling**: Processing payment events, subscription lifecycle
- **Error Recovery**: Implementing retry logic, fallback providers, idempotency
- **Testing**: Generating test scenarios, mock webhook events
- **Debugging**: Analyzing payment failures, webhook issues, log analysis
- **Documentation**: Creating payment flow diagrams, API documentation

## Provider Capabilities Matrix

| Capability | Stripe | Moyasar | LemonSqueezy |
|------------|--------|---------|--------------|
| Card Payments | Yes | Yes | Yes |
| Apple Pay | Yes | Yes | Yes |
| Google Pay | Yes | No | Yes |
| Mada (Saudi) | No | Yes | No |
| STC Pay | No | Yes | No |
| Subscriptions | Yes | Simulated | Yes |
| Trials | Yes | No | Yes |
| Coupons | Yes | No | Yes |
| EU VAT (MoR) | No | No | Yes |
| Billing Portal | Yes | No | Yes |
| Invoicing | Yes | Yes | Yes |
| Refunds | Yes | Yes | Yes |
| Partial Refunds | Yes | Yes | No |

## Region-Based Provider Selection

### Decision Logic

```typescript
function selectProvider(countryCode: string): PaymentProvider {
  const GCC_COUNTRIES = ["SA", "AE", "KW", "QA", "BH", "OM"];
  const EU_COUNTRIES = [
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
    "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
    "PL", "PT", "RO", "SK", "SI", "ES", "SE"
  ];

  if (GCC_COUNTRIES.includes(countryCode)) {
    return PaymentProvider.MOYASAR;
  }

  if (EU_COUNTRIES.includes(countryCode)) {
    return PaymentProvider.LEMON_SQUEEZY;
  }

  return PaymentProvider.STRIPE;
}
```

### IP Detection Flow

```
User Request -> Extract IP -> GeoIP Lookup -> Country Code
                                                  |
                                       Provider Selection
                                                  |
                                 Region Info (currency, RTL, locale)
```

### Currency Mapping

| Region | Countries | Provider | Primary Currency |
|--------|-----------|----------|------------------|
| GCC | SA, AE, KW, QA, BH, OM | Moyasar | SAR |
| EU | 27 EU member states | LemonSqueezy | EUR |
| Global | All others | Stripe | USD |

## Payment Flow Orchestration

### Checkout -> Webhook -> Fulfillment

```
Phase 1: Checkout Initiation
  User selects plan -> Frontend calls createCheckout
  -> Backend determines provider (region detection)
  -> Provider.createCheckoutSession() called
  -> Return checkout URL to frontend
  -> Redirect user to provider's hosted checkout

Phase 2: Payment Processing (Provider-side)
  User enters payment details on provider's secure page
  -> 3DS authentication if required
  -> Payment processed by provider
  -> Provider sends webhook event

Phase 3: Webhook Processing
  Receive webhook -> Verify signature
  -> Parse event type -> Route to handler
  -> Idempotency check (prevent duplicate processing)
  -> Process event -> Update database
  -> Return 200 OK (must be fast, < 30s)

Phase 4: Fulfillment
  Update subscription status in database
  -> Update user tier/limits
  -> Send confirmation email
  -> Log transaction for audit
```

## Error Recovery Patterns

### Retry with Exponential Backoff

```typescript
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (!isRetryableError(error)) {
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

function isRetryableError(error: unknown): boolean {
  if (isPaymentProviderError(error)) {
    const retryableCodes = [
      PaymentErrorCode.NETWORK_ERROR,
      PaymentErrorCode.RATE_LIMIT_EXCEEDED,
      PaymentErrorCode.API_ERROR,
    ];
    return retryableCodes.includes(error.code);
  }
  return false;
}
```

### Provider Fallback Strategy

```typescript
async function createCheckoutWithFallback(
  params: CreateCheckoutParams,
  primaryProvider: PaymentProvider,
  fallbackProvider?: PaymentProvider
): Promise<CheckoutSession> {
  try {
    const primary = PaymentProviderFactory.get(primaryProvider);
    return await primary.createCheckoutSession(params);
  } catch (error) {
    if (fallbackProvider && isFallbackEligible(error)) {
      console.warn(`Primary provider ${primaryProvider} failed, trying fallback`);
      const fallback = PaymentProviderFactory.get(fallbackProvider);
      return await fallback.createCheckoutSession(params);
    }
    throw error;
  }
}
```

### Idempotency Implementation

```typescript
async function processWebhookIdempotently(
  eventId: string,
  provider: PaymentProvider,
  processor: () => Promise<void>
): Promise<{ processed: boolean; duplicate: boolean }> {
  const existing = await db.query.webhookEvents.findFirst({
    where: and(
      eq(webhookEvents.eventId, eventId),
      eq(webhookEvents.provider, provider)
    ),
  });

  if (existing?.status === "processed") {
    return { processed: true, duplicate: true };
  }

  const record = await db.insert(webhookEvents).values({
    id: nanoid(),
    eventId,
    provider,
    status: "processing",
    createdAt: new Date(),
  }).returning();

  try {
    await processor();

    await db.update(webhookEvents)
      .set({ status: "processed", processedAt: new Date() })
      .where(eq(webhookEvents.id, record[0].id));

    return { processed: true, duplicate: false };
  } catch (error) {
    await db.update(webhookEvents)
      .set({ status: "failed", error: String(error) })
      .where(eq(webhookEvents.id, record[0].id));

    throw error;
  }
}
```

## Test Scenario Generation

### Test Card Numbers

| Provider | Card Number | Scenario |
|----------|-------------|----------|
| Stripe | 4242424242424242 | Success |
| Stripe | 4000000000000002 | Declined |
| Stripe | 4000000000003220 | 3DS Required |
| Moyasar | 4111111111111111 | Success |
| Moyasar | 4000000000000077 | Declined |
| Moyasar | 5105105105105100 | Mada Success |

### Mock Webhook Events

```typescript
function generateMockWebhookEvent(
  provider: PaymentProvider,
  eventType: WebhookEventType,
  data: Record<string, unknown>
): WebhookEvent {
  return {
    id: `evt_test_${nanoid()}`,
    provider,
    type: eventType,
    livemode: false,
    data: { object: data },
    createdAt: new Date(),
    rawPayload: JSON.stringify(data),
  };
}

const mockPaymentSucceeded = generateMockWebhookEvent(
  PaymentProvider.STRIPE,
  WebhookEventType.PAYMENT_SUCCEEDED,
  {
    id: "pi_test_123",
    amount: 2900,
    currency: "usd",
    status: "succeeded",
    metadata: {
      organizationId: "org_test",
      subscriptionId: "sub_test",
    },
  }
);
```

### E2E Test Scenarios

```gherkin
Feature: Payment Checkout Flow

  Scenario: Successful subscription checkout
    Given a user in the United States
    When they select the Pro Monthly plan
    Then they should be redirected to Stripe checkout
    And after payment completion
    Then a webhook should activate their subscription
    And their tier should be updated to "pro"

  Scenario: Saudi Arabia user with Mada card
    Given a user in Saudi Arabia
    When they select the Pro Monthly plan
    Then they should be redirected to Moyasar checkout
    And the Mada payment option should be available
    And amount should be displayed in SAR

  Scenario: EU user with VAT handling
    Given a user in Germany
    When they select the Pro Monthly plan
    Then they should be redirected to LemonSqueezy checkout
    And VAT should be calculated automatically
    And invoice should include VAT number
```

## Debugging Payment Issues

### Log Analysis Patterns

```typescript
async function analyzePaymentFailure(paymentId: string): Promise<{
  diagnosis: string;
  suggestions: string[];
}> {
  const transaction = await db.query.paymentTransactions.findFirst({
    where: eq(paymentTransactions.providerTransactionId, paymentId),
  });

  if (!transaction) {
    return {
      diagnosis: "Transaction not found in database",
      suggestions: [
        "Check if webhook was received",
        "Verify provider transaction ID format",
        "Check database connection",
      ],
    };
  }

  if (transaction.status === "failed") {
    const suggestions = [];

    if (transaction.failureCode === "card_declined") {
      suggestions.push("Customer should try a different card");
      suggestions.push("Verify card has sufficient funds");
    }

    if (transaction.failureCode === "authentication_required") {
      suggestions.push("3DS authentication was not completed");
      suggestions.push("Check if return_url is configured correctly");
    }

    return {
      diagnosis: `Payment failed: ${transaction.failureMessage}`,
      suggestions,
    };
  }

  return {
    diagnosis: `Transaction status: ${transaction.status}`,
    suggestions: [],
  };
}
```

### Webhook Replay for Testing

```typescript
async function replayWebhook(
  webhookEventId: string
): Promise<{ success: boolean; result: unknown }> {
  const event = await db.query.webhookEvents.findFirst({
    where: eq(webhookEvents.id, webhookEventId),
  });

  if (!event) {
    throw new Error("Webhook event not found");
  }

  await db.update(webhookEvents)
    .set({ status: "pending", retryCount: event.retryCount + 1 })
    .where(eq(webhookEvents.id, webhookEventId));

  const handler = getWebhookHandler(event.provider);
  const result = await handler.processEvent({
    id: event.eventId,
    provider: event.provider,
    type: event.eventType,
    livemode: false,
    data: { object: event.payload },
    createdAt: event.createdAt,
    rawPayload: JSON.stringify(event.payload),
  });

  return { success: result.success, result };
}
```

## Agents to Spawn

### moyasar-payment-expert

**When to spawn**: MENA region payments, Mada integration, STC Pay, Arabic RTL support

**Expertise**:
- Moyasar API v1
- Mada card detection and handling
- Apple Pay for Saudi merchants
- STC Pay OTP flow
- HMAC-SHA256 webhook verification
- SAR currency formatting

### stripe-billing-specialist

**When to spawn**: Global payments, subscription management, billing portal, Stripe Elements

**Expertise**:
- Stripe API (version 2024-09-30.acacia)
- Checkout Sessions
- Subscription lifecycle
- Customer portal
- Webhook signature verification
- Price and product management

### lemonsqueezy-payment-expert

**When to spawn**: EU VAT handling, merchant of record requirements, European customers

**Expertise**:
- LemonSqueezy API
- VAT calculation and compliance
- Checkout overlay integration
- License key management
- EU tax reporting

## Reference Files

- [Provider API Documentation](./references/provider-docs.md)
- [Webhook Event Patterns](./references/webhook-patterns.md)

## Troubleshooting

**Problem**: Webhook signature verification fails
**Solution**:
1. Verify webhook secret matches provider dashboard
2. Ensure raw body is used (not parsed JSON)
3. Check signature header name (varies by provider)
4. Verify timing - signatures may expire

**Problem**: Customer charged but subscription not activated
**Solution**:
1. Check webhook endpoint is accessible
2. Verify webhook event was received (check logs)
3. Confirm idempotency key wasn't duplicated
4. Check database transaction completed
5. Verify subscription ID in webhook metadata

**Problem**: Region detection returns wrong provider
**Solution**:
1. Verify IP geolocation service is configured
2. Check GeoIP database is up to date
3. Confirm country code mapping is correct
4. Test with explicit country code override

**Problem**: 3DS authentication not completing
**Solution**:
1. Verify return_url is correctly configured
2. Check HTTPS is used for callback URLs
3. Ensure frontend handles redirect properly
4. Test with 3DS test card numbers

**Problem**: Partial refund fails
**Solution**:
1. Check provider supports partial refunds (Stripe, Moyasar: yes; LemonSqueezy: no)
2. Verify refund amount <= original charge - previous refunds
3. Ensure payment was captured (not just authorized)
4. Check refund window hasn't expired

## Examples

### Example 1: Implementing Checkout for New Plan

```typescript
async function createProPlanCheckout(
  userId: string,
  countryCode: string,
  isAnnual: boolean
): Promise<{ checkoutUrl: string; provider: string }> {
  const provider = selectProvider(countryCode);
  const priceId = getPriceId(provider, "pro", isAnnual);
  const currency = getCurrency(countryCode);

  const session = await PaymentProviderFactory.get(provider)
    .createCheckoutSession({
      mode: CheckoutMode.SUBSCRIPTION,
      lineItems: [{ priceId, quantity: 1 }],
      customerEmail: user.email,
      successUrl: `${SITE_URL}/dashboard?checkout=success`,
      cancelUrl: `${SITE_URL}/pricing`,
      metadata: {
        userId,
        plan: "pro",
        billing: isAnnual ? "annual" : "monthly",
      },
    });

  return {
    checkoutUrl: session.url,
    provider: provider,
  };
}
```

### Example 2: Handling Subscription Webhook

```typescript
async function handleSubscriptionCreated(
  event: WebhookEvent
): Promise<void> {
  const subscription = event.data.object as SubscriptionData;
  const { userId, plan } = subscription.metadata;

  await db.transaction(async (tx) => {
    await tx.insert(organizationSubscriptions).values({
      id: nanoid(),
      organizationId: userId,
      provider: event.provider,
      providerSubscriptionId: subscription.id,
      planType: plan,
      status: "active",
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await tx.update(organizations)
      .set({
        tier: plan,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, userId));
  });

  await sendSubscriptionConfirmationEmail(userId, plan);
}
```

### Example 3: Testing Payment Flow

```typescript
describe("Payment Checkout Flow", () => {
  it("should create Stripe checkout for US users", async () => {
    const result = await createProPlanCheckout("user_123", "US", false);

    expect(result.provider).toBe("stripe");
    expect(result.checkoutUrl).toContain("checkout.stripe.com");
  });

  it("should create Moyasar checkout for Saudi users", async () => {
    const result = await createProPlanCheckout("user_123", "SA", false);

    expect(result.provider).toBe("moyasar");
    expect(result.checkoutUrl).toContain("moyasar.com");
  });

  it("should create LemonSqueezy checkout for German users", async () => {
    const result = await createProPlanCheckout("user_123", "DE", false);

    expect(result.provider).toBe("lemon_squeezy");
    expect(result.checkoutUrl).toContain("lemonsqueezy.com");
  });
});
```
