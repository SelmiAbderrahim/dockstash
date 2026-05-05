---
name: subscription-workflow
description: |
  Master subscription management including plan selection, payment processing with Stripe, credit system implementation, upgrade/downgrade logic, and usage-based billing.

  When to use: Implementing subscription features, managing billing cycles, handling Stripe webhooks, tracking user credits, implementing plan upgrades/downgrades, managing billing history, handling cancellations and refunds.

  Keywords: Subscriptions, Stripe, billing, payments, credits, plans, upgrades, downgrades, invoices, webhooks, recurring billing, usage tracking
---

# Subscription Workflow

## Quick Start (Layer 1-2)

The subscription workflow handles complete SaaS billing including plan management, payment processing, credit tracking, and billing history.

### Three Subscription Models

```typescript
// 1. Free Tier - Limited credits, view-only features
const freeSubscription = {
  planId: "free",
  creditsPerMonth: 100,
  maxVideos: 5,
  maxTranscriptLength: 30, // minutes
  features: ["video_upload", "transcription", "basic_chat"],
  stripeProductId: null, // No payment required
  price: 0,
  billingPeriod: "monthly"
};

// 2. Pro Tier - Generous credits, priority support
const proSubscription = {
  planId: "pro",
  creditsPerMonth: 5000,
  maxVideos: 500,
  maxTranscriptLength: null, // Unlimited
  features: ["video_upload", "transcription", "ai_chat", "analytics", "priority_support"],
  stripeProductId: "prod_pro_123",
  price: 29.99,
  billingPeriod: "monthly"
};

// 3. Enterprise Tier - Custom credits, dedicated support
const enterpriseSubscription = {
  planId: "enterprise",
  creditsPerMonth: null, // Custom
  maxVideos: null, // Unlimited
  maxTranscriptLength: null, // Unlimited
  features: ["all_features", "api_access", "custom_integration", "dedicated_support"],
  stripeProductId: "prod_enterprise_123",
  price: null, // Custom pricing
  billingPeriod: "annual"
};
```

### Key Concepts

- **Subscription Plans**: Free, Pro, Enterprise with tier-specific features and credits
- **Payment Processing**: Stripe integration for secure card handling, recurring billing
- **Credit System**: Monthly credit allocation, usage tracking, rollover policies
- **Upgrade/Downgrade**: Prorated billing, immediate access to new features
- **Usage Tracking**: Real-time credit deduction, analytics dashboard
- **Billing History**: Invoice storage, payment receipts, audit trail
- **Cancellation**: Refund logic, data retention, account cleanup

### Most Common Use Case

```typescript
// User registration and subscription flow
1. User signs up with email/password
2. System creates free subscription automatically
3. User receives 100 free credits
4. After 100 credits used, can upgrade to Pro ($29.99/month)
5. Stripe creates subscription, 5000 credits added immediately
6. Monthly renewal: credits reset, card charged $29.99
7. User can upgrade to Enterprise, downgrade to Free, or cancel
```

## Key Files & References

- `/prompts/agents/specialized/subscription-workflow-manager.md` - Specialized agent guide
- `guide.md` - Complete implementation patterns (Layer 3)
- `patterns.md` - Advanced patterns and edge cases (Layer 3)
- `troubleshooting.md` - Common issues and solutions (Layer 3)
- `examples/` - Real-world code examples (Layer 3)

## Core Workflow Steps

1. **Plan Selection Phase**
   - Display available plans with features/pricing
   - Validate user eligibility for tier
   - Calculate prorated charges on upgrade/downgrade
   - Store plan preference

2. **Payment Processing Phase**
   - Create Stripe customer
   - Tokenize payment method (card details)
   - Create subscription in Stripe
   - Handle payment failures with retry
   - Update subscription status

3. **Credit Allocation Phase**
   - Calculate monthly credit allowance
   - Add initial credits to account
   - Set credit reset date
   - Enable auto-renewal

4. **Usage Tracking Phase**
   - Deduct credits on action (chat, transcription)
   - Track usage per user
   - Update credit balance in real-time
   - Log for analytics

5. **Renewal & Billing Phase**
   - Process monthly/annual renewal
   - Charge card via Stripe
   - Handle failed charges with retry
   - Reset credits on renewal date
   - Generate invoice

6. **Lifecycle Management Phase**
   - Handle upgrades with prorating
   - Handle downgrades with grace period
   - Handle cancellations with data retention
   - Process refunds
   - Cleanup on account deletion

## Essential Patterns

### Plan Management Pattern
```typescript
export const getPlanDetails = query({
  handler: async (ctx, args: { planId: string }) => {
    const plan = PLAN_CONFIGS[args.planId];
    return {
      id: plan.planId,
      name: plan.name,
      price: plan.price,
      credits: plan.creditsPerMonth,
      features: plan.features,
      stripeProductId: plan.stripeProductId
    };
  }
});
```

### Credit Deduction Pattern
```typescript
export const deductCredits = mutation({
  handler: async (ctx, args: { userId, costCredits }) => {
    const user = await ctx.db.get(args.userId);
    const currentSubscription = await getCurrentSubscription(ctx, args.userId);

    const remaining = currentSubscription.creditsAllowed - (currentSubscription.creditsUsed || 0);
    if (remaining < args.costCredits) {
      throw new ConvexError({ code: "INSUFFICIENT_CREDITS" });
    }

    await ctx.db.patch(currentSubscription._id, {
      creditsUsed: (currentSubscription.creditsUsed || 0) + args.costCredits
    });

    return { creditsRemaining: remaining - args.costCredits };
  }
});
```

### Stripe Webhook Pattern
```typescript
// Webhook endpoint receives Stripe events
POST /api/webhooks/stripe
{
  "type": "customer.subscription.updated",
  "data": { "object": { "id": "sub_123", "status": "active" } }
}

// Handle subscription events
if (event.type === "customer.subscription.updated") {
  await updateSubscriptionStatus(event.data.object);
} else if (event.type === "invoice.payment_succeeded") {
  await recordPayment(event.data.object);
} else if (event.type === "invoice.payment_failed") {
  await handleFailedPayment(event.data.object);
}
```

### Upgrade/Downgrade Pattern
```typescript
// Calculate prorated amount for upgrade
const daysRemaining = Math.ceil((renewalDate - now) / (1000 * 60 * 60 * 24));
const currentDayRate = currentPlan.monthlyPrice / 30;
const newDayRate = newPlan.monthlyPrice / 30;
const prorationAmount = (newDayRate - currentDayRate) * daysRemaining;

// Create new subscription with prorated charge
await stripe.subscriptions.create({
  customer: stripeCustomerId,
  items: [{ price: newPlan.stripePriceId }],
  proration_behavior: "create_prorations"
});
```

## What You'll Learn

In this skill, you'll understand:
- How to design multi-tier subscription systems
- How to integrate Stripe for payments
- How to implement credit-based usage limits
- How to handle recurring billing and renewals
- How to process upgrades/downgrades with prorating
- How to manage failed payments and retries
- How to track usage and generate invoices
- How to handle cancellations and refunds
- How to implement webhook handlers
- How to prevent credit abuse

## Next Steps

1. **For Implementation**: See `guide.md` for complete patterns
2. **For Advanced Patterns**: See `patterns.md` for edge cases
3. **For Troubleshooting**: See `troubleshooting.md` for common issues
4. **For Code Examples**: See `examples/` directory
5. **For Related Workflows**: See `video-upload-workflow/`, `transcription-workflow/`, or `ai-chat-workflow/`
