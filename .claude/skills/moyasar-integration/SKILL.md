---
name: moyasar-integration
description: Comprehensive guide for integrating Moyasar payment gateway in Saudi Arabian and Middle Eastern applications. Use when implementing payment processing with Mada cards, Apple Pay, STC Pay, Samsung Pay, or credit cards. Covers web integration, mobile SDKs (iOS, Android, Flutter, React Native), webhooks, and eCommerce plugins.
---

# Moyasar Payment Integration Skill

## Overview

This skill provides comprehensive guidance for integrating Moyasar payment gateway into applications targeting Saudi Arabia and the Middle East.

## When to Use This Skill

- Setting up payment processing for Saudi Arabian market
- Integrating Mada card payments (Saudi debit network)
- Implementing Apple Pay for iOS applications
- Adding STC Pay (Saudi mobile carrier payments)
- Configuring Samsung Pay for Android
- Building payment forms with Moyasar.js
- Implementing mobile payment SDKs
- Setting up payment webhooks
- Configuring eCommerce plugins (WooCommerce, Magento, etc.)
- Testing with sandbox environment

## Reference Documentation

For detailed implementation guides, load the following reference files as needed:

### Core Documentation
- [Overview & Quick Start](./references/overview.md) - API keys, environments, currency handling
- [Payments API](./references/payments-api.md) - Create, retrieve, refund payments
- [Web Integration](./references/web-integration.md) - Moyasar.js payment forms

### Mobile SDKs
- [iOS SDK](./references/ios-sdk.md) - Swift/SwiftUI integration
- [Android SDK](./references/android-sdk.md) - Kotlin/Java integration
- [Flutter SDK](./references/flutter-sdk.md) - Cross-platform Flutter
- [React Native SDK](./references/react-native-sdk.md) - React Native integration

### Testing & Security
- [Test Cards](./references/test-cards.md) - Sandbox test cards and OTPs
- [Webhooks](./references/webhooks.md) - Event handling and verification
- [Best Practices](./references/best-practices.md) - Security and implementation patterns

## Quick Implementation Guide

### Step 1: Environment Setup

```bash
# Add to .env (root level only per project rules)
MOYASAR_PUBLISHABLE_KEY=pk_test_your_key_here
MOYASAR_SECRET_KEY=sk_test_your_key_here
MOYASAR_WEBHOOK_SECRET=your_webhook_secret
```

### Step 2: Choose Integration Method

| Platform | Recommended Approach |
|----------|---------------------|
| Web (React/Next.js) | Moyasar.js + Backend verification |
| iOS | MoyasarSdk (Swift/SwiftUI) |
| Android | moyasar-android-sdk (Kotlin) |
| Flutter | moyasar package |
| React Native | react-native-moyasar-sdk |
| eCommerce | Platform-specific plugin |

### Step 3: Implement Backend Verification

**Critical**: Always verify payments on the backend before fulfilling orders.

```typescript
// lib/moyasar/verify.ts
export async function verifyPayment(paymentId: string, expectedAmount: number) {
  const payment = await getPaymentFromMoyasar(paymentId);

  if (payment.status !== 'paid') {
    throw new Error('Payment not completed');
  }

  if (payment.amount !== expectedAmount) {
    throw new Error('Amount mismatch');
  }

  return payment;
}
```

### Step 4: Handle Webhooks

Set up webhook endpoint for reliable payment status updates:

```typescript
// api/webhooks/moyasar.ts
export async function POST(request: Request) {
  const body = await request.text();
  const event = JSON.parse(body);

  switch (event.type) {
    case 'payment.paid':
      await handlePaymentSuccess(event.data);
      break;
    case 'payment.failed':
      await handlePaymentFailure(event.data);
      break;
  }

  return new Response('OK', { status: 200 });
}
```

## Key Implementation Rules

### 1. Security Requirements

| Rule | Requirement |
|------|-------------|
| Secret Key | Backend only, NEVER in frontend |
| HTTPS | Required for all API calls |
| Verification | Always verify payments server-side |
| Cardholder Data | Never handle raw card data on your server |

### 2. Amount Handling

Moyasar uses smallest currency unit:
- 1000 = 10.00 SAR
- Minimum: 100 (1.00 SAR)

```typescript
const toHalalas = (sar: number) => Math.round(sar * 100);
const toSar = (halalas: number) => halalas / 100;
```

### 3. API Key Prefixes

| Environment | Publishable | Secret |
|-------------|-------------|--------|
| Sandbox | `pk_test_` | `sk_test_` |
| Production | `pk_live_` | `sk_live_` |

## Supported Payment Methods

| Method | Platforms | Notes |
|--------|-----------|-------|
| Visa | All | 3DS supported |
| Mastercard | All | 3DS supported |
| Mada | All | Saudi debit network |
| American Express | All | 4-digit CVC |
| Apple Pay | iOS, Web | Requires physical device for testing |
| STC Pay | All | Saudi mobile carrier |
| Samsung Pay | Android | Requires data binding |

## Testing Checklist

Before going live:
- [ ] Test with all documented test cards
- [ ] Verify 3DS flow works correctly
- [ ] Test webhook delivery
- [ ] Verify refund functionality
- [ ] Test error handling for all decline scenarios
- [ ] Confirm amount and currency validation
- [ ] Test idempotency with same request
- [ ] Verify Apple Pay on physical device (if applicable)
- [ ] Test STC Pay with all OTP scenarios

## Common Integration Patterns

### Pattern 1: Simple Web Payment

1. Include Moyasar.js
2. Initialize payment form
3. Handle callback redirect
4. Verify payment on backend
5. Fulfill order

### Pattern 2: Mobile In-App Payment

1. Install SDK (iOS/Android/Flutter/React Native)
2. Configure PaymentRequest
3. Present payment UI
4. Handle PaymentResult
5. Verify on backend

### Pattern 3: Subscription with Saved Cards

1. Enable `saveCard: true` in payment config
2. Capture token from successful payment
3. Store token securely
4. Use token for future payments

## Error Handling

| Error | Meaning | Action |
|-------|---------|--------|
| `insufficient_funds` | Card declined | Ask for different payment method |
| `lost_card` | Card reported lost | Ask for different card |
| `expired_card` | Card expired | Ask to update card |
| `3ds_failed` | Authentication failed | Retry or use different card |
| `invalid_card` | Invalid card details | Check and re-enter |

## Reference Projects

To see implementation examples, explore:
- `/docs/reference/moyasar/` - Complete documentation
- `.claude/agents/integrations/moyasar-payment-expert.md` - Agent with code patterns
