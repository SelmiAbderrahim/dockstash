# Subscription Workflow - Troubleshooting

## Issue 1: Payment Processing Fails (Declined Card)

### Symptoms
- User sees "Payment failed" error
- Card is declined in Stripe
- Subscription not created

### Root Causes
1. **Card details incorrect** - Wrong expiry, CVC, or zip code
2. **Insufficient funds** - Card doesn't have enough balance
3. **Card locked** - Bank flagged as suspicious transaction
4. **Address mismatch** - Billing address doesn't match card issuer records
5. **3D Secure required** - Card requires additional verification

### Debugging Steps

```typescript
// 1. Check Stripe payment intent status
const paymentIntent = await stripe.paymentIntents.retrieve(intentId);
console.log("Status:", paymentIntent.status);
console.log("Last error:", paymentIntent.last_payment_error);

// Possible statuses:
// - succeeded: Payment worked
// - processing: Still processing
// - requires_action: 3D Secure or similar
// - requires_confirmation: Needs additional confirmation
// - requires_payment_method: Need different card
// - canceled: Payment was canceled
```

### Solution

**For Users**:
1. **Check card details** - Verify expiry date, CVC, billing zip
2. **Try different card** - Use alternative payment method
3. **Contact bank** - May need to unblock transaction
4. **Enable 3D Secure** - Complete additional verification if prompted
5. **Wait and retry** - Some declines are temporary (insufficient funds)

**For Developers**:

```typescript
// Show detailed error messages
const errorMessages = {
  card_declined: "Your card was declined. Please try a different payment method.",
  expired_card: "Your card has expired. Please update your payment method.",
  generic_decline: "Payment declined by your bank. Please contact support.",
  processing_error: "Payment processing error. Please try again.",
  rate_limit: "Too many payment attempts. Wait a moment and try again."
};

// Handle payment errors in mutation
try {
  const paymentIntent = await stripe.paymentIntents.create({...});
} catch (error) {
  if (error.code === "card_declined") {
    throw new ConvexError({
      code: "PAYMENT_FAILED",
      message: errorMessages.card_declined,
      declineCode: error.decline_code // For more specific handling
    });
  }
  // Handle other error codes
}
```

### Prevention

- **Add card validation** - Validate format before submission to Stripe
- **Implement 3D Secure** - Handle requiring additional authentication
- **Retry logic** - Implement exponential backoff for transient failures
- **Show helpful messages** - Display specific decline reasons to users

**Files to Check**:
- `client/convex/subscriptions/createSubscription.ts` - Payment processing
- `client/src/lib/stripe.ts` - Stripe configuration
- `client/src/components/BillingForm.tsx` - Payment form validation

---

## Issue 2: Credits Not Resetting on Renewal

### Symptoms
- User's monthly credit allowance not reset
- Credits show as used even after renewal date
- Subscription shows "active" but credits unchanged

### Root Causes
1. **Renewal job didn't run** - Cron job missed execution
2. **Time zone mismatch** - Renewal date comparison using wrong timezone
3. **Database patch failed** - Update operation had error
4. **Stripe webhook missed** - `customer.subscription.updated` event not received
5. **Race condition** - Multiple renewal processes running simultaneously

### Debugging Steps

```typescript
// 1. Check subscription status in database
const subscription = await ctx.db.query("subscriptions")
  .filter(s => s.eq(s.field("userId"), userId))
  .first();

console.log("Current credits:", subscription.creditsUsed);
console.log("Monthly allowance:", subscription.creditsAllowed);
console.log("Renewal date:", new Date(subscription.renewalDate));
console.log("Last renewal:", new Date(subscription.lastRenewalAt || 0));

// 2. Check if renewal date has passed
const now = Date.now();
const isOverdue = subscription.renewalDate < now;
console.log("Is renewal overdue?", isOverdue);

// 3. Check Stripe subscription status
const stripeSubscription = await stripe.subscriptions.retrieve(
  subscription.stripeSubscriptionId
);
console.log("Stripe status:", stripeSubscription.status);
console.log("Current period end:", new Date(stripeSubscription.current_period_end * 1000));

// 4. Check if processMonthlyRenewal was called
const billingHistory = await ctx.db.query("billingHistory")
  .filter(b => b.eq(b.field("type"), "credit_reset"))
  .filter(b => b.eq(b.field("subscriptionId"), subscription._id))
  .order("desc")
  .first();

console.log("Last credit reset:", billingHistory ? new Date(billingHistory.timestamp) : "Never");
```

### Solution

**Immediate Fix**:

```typescript
// Manually trigger renewal for user
export const manuallyResetCredits = mutation({
  handler: async (ctx, args: { userId: Id<"users"> }) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user || user.subject !== args.userId) throw new Error("Unauthorized");

    const subscription = await ctx.db
      .query("subscriptions")
      .filter(s => s.eq(s.field("userId"), args.userId))
      .first();

    if (!subscription) throw new Error("No subscription");

    // Reset credits
    const CREDITS = { free: 100, pro: 5000 };
    const creditAmount = CREDITS[subscription.planId] || 0;

    await ctx.db.patch(subscription._id, {
      creditsAllowed: creditAmount,
      creditsUsed: 0,
      renewalDate: addMonths(Date.now(), 1),
      lastRenewalAt: Date.now()
    });

    return { success: true, creditsReset: creditAmount };
  }
});
```

**Prevention**:

1. **Fix timezone handling**:
```typescript
// Use UTC consistently
const now = new Date().getTime(); // milliseconds UTC
const renewalDate = subscription.renewalDate; // stored as UTC milliseconds
const isOverdue = renewalDate <= now;
```

2. **Add renewal status tracking**:
```typescript
// Track renewal attempts
await ctx.db.insert("renewalLog", {
  subscriptionId: subscription._id,
  attemptedAt: Date.now(),
  status: "success" | "failed",
  reason: "...",
  creditsReset: 5000
});
```

3. **Implement idempotent renewal**:
```typescript
// Check if already renewed this period
const alreadyRenewed = subscription.lastRenewalAt &&
  getMonthFromDate(subscription.lastRenewalAt) === getMonthFromDate(Date.now());

if (alreadyRenewed) {
  return { skipped: true, reason: "Already renewed this period" };
}
```

**Files to Check**:
- `client/convex/subscriptions/processMonthlyRenewal.ts` - Renewal logic
- `client/convex/schema.ts` - Subscription table and indexes
- Stripe webhook handler - Verify `customer.subscription.updated` is processed
- Cron job configuration - Ensure renewal job is scheduled

---

## Issue 3: User Can Access Features Beyond Credit Limit

### Symptoms
- User with 0 credits can still transcribe videos
- Chat responses generated even with insufficient credits
- Feature not blocked when credits exhausted

### Root Causes
1. **Credit check missing** - No validation before operation
2. **Credit deduction not called** - Usage logged but credits not deducted
3. **Race condition** - Multiple requests processed before credit updated
4. **Cached credit value** - Client using stale credit balance

### Debugging Steps

```typescript
// 1. Verify credit check exists in mutation
export const transcribeVideo = mutation({
  handler: async (ctx, args) => {
    // ❌ WRONG - No credit check!
    const transcript = await submitToAssemblyAI(args.audioUrl);

    // ✅ CORRECT - Check credits first
    const creditValidation = await validateCredits(ctx, args.userId, 500);
    if (!creditValidation.canProceed) {
      throw new ConvexError({ code: "INSUFFICIENT_CREDITS" });
    }

    const transcript = await submitToAssemblyAI(args.audioUrl);

    // Deduct credits AFTER successful submission
    await deductCredits(ctx, args.userId, 500);
  }
});

// 2. Check credit deduction is called
const usageLogs = await ctx.db.query("usageLog")
  .filter(u => u.eq(u.field("userId"), userId))
  .order("desc")
  .take(5);

console.log("Recent usage:", usageLogs.map(u => ({
  action: u.actionType,
  credits: u.creditsDeducted,
  time: new Date(u.timestamp)
})));
```

### Solution

**Add Credit Validation to All Cost Operations**:

```typescript
// 1. Create reusable validation function
export const validateUserCredits = async (
  ctx: any,
  userId: string,
  requiredCredits: number
): Promise<{ canProceed: boolean; creditsAvailable: number }> => {
  const subscription = await ctx.db
    .query("subscriptions")
    .filter(s => s.eq(s.field("userId"), userId))
    .first();

  if (!subscription) {
    throw new Error("No subscription");
  }

  const creditsAvailable = (subscription.creditsAllowed || 0) - (subscription.creditsUsed || 0);

  return {
    canProceed: creditsAvailable >= requiredCredits,
    creditsAvailable
  };
};

// 2. Use in all mutations
export const chatMessage = mutation({
  handler: async (ctx, args: { userId: string; message: string }) => {
    // Check credits FIRST
    const validation = await validateUserCredits(ctx, args.userId, 500);
    if (!validation.canProceed) {
      throw new ConvexError({
        code: "INSUFFICIENT_CREDITS",
        message: `Need 500 credits, have ${validation.creditsAvailable}`
      });
    }

    // Generate response
    const response = await generateChatResponse(args.message);

    // Deduct credits AFTER generation
    await deductCreditsForAction(ctx, {
      userId: args.userId,
      actionType: "chat",
      costCredits: 500
    });

    return { response };
  }
});

// 3. Use optimistic locking to prevent race conditions
export const deductCreditsWithLocking = mutation({
  handler: async (ctx, args: { userId: string; costCredits: number }) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .filter(s => s.eq(s.field("userId"), args.userId))
      .first();

    // Check before update
    const creditsAvailable = subscription.creditsAllowed - (subscription.creditsUsed || 0);
    if (creditsAvailable < args.costCredits) {
      throw new ConvexError({ code: "INSUFFICIENT_CREDITS" });
    }

    // Atomic update
    await ctx.db.patch(subscription._id, {
      creditsUsed: (subscription.creditsUsed || 0) + args.costCredits
    });

    return { success: true };
  }
});
```

**Files to Check**:
- All mutation files that deduct credits
- Ensure credit validation happens BEFORE operation
- Check Convex subscriptions module for credit logic

---

## Issue 4: Stripe Webhook Events Not Received

### Symptoms
- Payment succeeded in Stripe but subscription not created in database
- `customer.subscription.updated` not updating local record
- Manual status check shows different state than database

### Root Causes
1. **Webhook not configured** - Endpoint not added to Stripe dashboard
2. **Wrong endpoint URL** - Webhook points to development/wrong URL
3. **Signature validation failing** - Secret key mismatch
4. **Network issues** - Stripe can't reach endpoint
5. **Endpoint returning non-200** - Error in webhook handler

### Debugging Steps

```typescript
// 1. Check webhook is registered in Stripe
// Go to: https://dashboard.stripe.com/webhooks
// Verify endpoint URL points to production

// 2. Check webhook secret key is correct
const secret = process.env.STRIPE_WEBHOOK_SECRET;
console.log("Has webhook secret:", !!secret);

// 3. Verify signature validation
const event = await stripe.webhooks.constructEvent(
  rawBody,
  signature,
  webhookSecret
);
// If this throws, signature is invalid

// 4. Check webhook logs in Stripe dashboard
// https://dashboard.stripe.com/webhooks - click endpoint
// Shows recent attempts, responses, and errors

// 5. Test webhook manually
// Use Stripe CLI: stripe listen --forward-to localhost:8080/api/webhooks/stripe
// Then trigger event: stripe trigger customer.subscription.updated
```

### Solution

**Setup Webhook Handler**:

```typescript
// 1. Configure Stripe webhook endpoint
// In Stripe Dashboard:
// 1. Settings > Webhooks > Add endpoint
// 2. URL: https://yourdomain.com/api/webhooks/stripe
// 3. Events: customer.subscription.updated, invoice.payment_succeeded, invoice.payment_failed
// 4. Copy webhook secret

// 2. Add environment variable
// .env: STRIPE_WEBHOOK_SECRET=whsec_...

// 3. Create webhook handler
export const handleStripeWebhook = action({
  handler: async (ctx, args: { event: any; signature: string }) => {
    // Verify signature
    const event = verifyStripeSignature(args.event, args.signature);

    // Handle events
    switch (event.type) {
      case "customer.subscription.updated":
        return await handleSubscriptionUpdated(ctx, event.data.object);

      case "invoice.payment_succeeded":
        return await handlePaymentSucceeded(ctx, event.data.object);

      case "invoice.payment_failed":
        return await handlePaymentFailed(ctx, event.data.object);

      default:
        return { handled: false };
    }
  }
});

// 4. Update subscription from webhook
async function handleSubscriptionUpdated(ctx, stripeSubscription) {
  const subscription = await ctx.db
    .query("subscriptions")
    .filter(s => s.eq(s.field("stripeSubscriptionId"), stripeSubscription.id))
    .first();

  if (!subscription) {
    console.warn("Subscription not found for:", stripeSubscription.id);
    return { found: false };
  }

  // Update from Stripe data
  await ctx.db.patch(subscription._id, {
    status: stripeSubscription.status,
    renewalDate: new Date(stripeSubscription.current_period_end * 1000).getTime(),
    lastWebhookUpdate: Date.now()
  });

  return { updated: true };
}
```

**Testing in Development**:

```bash
# 1. Install Stripe CLI
# macOS: brew install stripe/stripe-cli/stripe
# Linux/Windows: https://stripe.com/docs/stripe-cli

# 2. Login to Stripe
stripe login

# 3. Forward webhooks to local endpoint
stripe listen --forward-to localhost:8080/api/webhooks/stripe

# 4. Get webhook signing secret (shown in terminal)
# Copy to .env: STRIPE_WEBHOOK_SECRET=...

# 5. Trigger test event
stripe trigger customer.subscription.updated

# 6. Check handler processes event
# Look for "Webhook received" logs
```

**Files to Check**:
- Webhook endpoint configuration (should be in `client/convex/stripe/webhook.ts` or similar)
- Stripe webhook secret in environment
- Verify webhook handler returns 200 on success

---

## Issue 5: Incorrect Prorated Amount on Upgrade

### Symptoms
- User upgrades and is charged wrong amount
- Prorated calculation doesn't match expectation
- Refund needed for overbilling

### Root Causes
1. **Wrong calculation formula** - Days/rates calculated incorrectly
2. **Timezone issues** - Renewal date in different timezone
3. **Rounding errors** - Floating point precision issues
4. **Subscription cycle boundary** - Not accounting for cycle start/end dates
5. **Stripe proration setting** - Wrong `proration_behavior` in API call

### Debugging Steps

```typescript
// 1. Get subscription details
const subscription = await ctx.db.get(subscriptionId);
console.log("Current plan:", subscription.planId);
console.log("Renewal date:", new Date(subscription.renewalDate));
console.log("Today:", new Date());

// 2. Calculate days remaining
const today = Date.now();
const daysRemaining = Math.ceil(
  (subscription.renewalDate - today) / (1000 * 60 * 60 * 24)
);
console.log("Days remaining:", daysRemaining);

// 3. Calculate daily rates
const PRICES = { free: 0, pro: 29.99, enterprise: 299.99 };
const currentPrice = PRICES[subscription.planId];
const newPrice = 49.99; // New plan price

const currentDailyRate = currentPrice / 30;
const newDailyRate = newPrice / 30;

console.log("Current daily rate:", currentDailyRate.toFixed(2));
console.log("New daily rate:", newDailyRate.toFixed(2));

// 4. Calculate proration
const daysUsedByCurrentPlan = 30 - daysRemaining;
const creditUsedForCurrentPlan = daysUsedByCurrentPlan * currentDailyRate;
const creditOwedForNewPlan = 30 * newDailyRate;
const proration = creditOwedForNewPlan - creditUsedForCurrentPlan;

console.log("Days used with current plan:", daysUsedByCurrentPlan);
console.log("Credit used for current plan:", creditUsedForCurrentPlan.toFixed(2));
console.log("Credit owed for new plan:", creditOwedForNewPlan.toFixed(2));
console.log("Proration amount:", proration.toFixed(2));
```

### Solution

**Fix Proration Calculation**:

```typescript
// 1. Use consistent timezone (always UTC)
function calculateProration(
  currentPlanId: string,
  newPlanId: string,
  renewalDate: number  // Always in milliseconds UTC
): number {
  const PLAN_PRICES = {
    free: 0,
    pro: 29.99,
    enterprise: 299.99
  };

  const currentPrice = PLAN_PRICES[currentPlanId];
  const newPrice = PLAN_PRICES[newPlanId];

  // Use standard 30-day billing cycle
  const cycleLength = 30;
  const now = Date.now();
  const daysRemaining = Math.ceil((renewalDate - now) / (1000 * 60 * 60 * 24));

  // Calculate daily rates
  const currentDailyRate = currentPrice / cycleLength;
  const newDailyRate = newPrice / cycleLength;

  // Amount already paid for current plan
  const daysUsed = cycleLength - daysRemaining;
  const amountAlreadyPaid = daysUsed * currentDailyRate;

  // Amount to charge for full new plan
  const amountForFullNewPlan = newPrice;

  // Proration (positive = charge, negative = credit)
  const proration = amountForFullNewPlan - amountAlreadyPaid;

  return Math.round(proration * 100) / 100; // Round to 2 decimals
}

// 2. Use correct Stripe proration behavior
const updatedSubscription = await stripe.subscriptions.update(
  stripeSubscriptionId,
  {
    items: [
      {
        id: stripeSubscriptionItemId,
        price: newStripePriceId
      }
    ],
    // Use "create_prorations" for Stripe to calculate
    proration_behavior: "create_prorations"
  }
);

// 3. Verify result
console.log("Upcoming invoice:", updatedSubscription.default_tax_ids);
const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
  subscription: stripeSubscriptionId
});
console.log("Prorated amount:", upcomingInvoice.lines.data[0].amount / 100);
```

**Files to Check**:
- `client/convex/subscriptions/upgradePlan.ts` - Upgrade logic
- Verify proration calculation uses consistent timezone
- Test with various plan combinations

---

## Issue 6: Webhook Retry Causing Duplicate Subscriptions

### Symptoms
- User charged multiple times for same upgrade
- Multiple subscription records in database for same user
- Duplicate charges appearing in Stripe

### Root Causes
1. **Non-idempotent handler** - Creates new record on retry
2. **No idempotency key** - Stripe retries create duplicates
3. **Missing upsert logic** - Doesn't check if subscription exists
4. **Race condition** - Multiple handlers processing same event

### Debugging Steps

```typescript
// 1. Check for duplicate subscriptions
const subscriptions = await ctx.db
  .query("subscriptions")
  .filter(s => s.eq(s.field("userId"), userId))
  .collect();

console.log(`Found ${subscriptions.length} subscriptions for user`);
if (subscriptions.length > 1) {
  console.warn("DUPLICATE SUBSCRIPTIONS - review and merge:");
  subscriptions.forEach(s => {
    console.log(`- ID: ${s._id}, Plan: ${s.planId}, Created: ${new Date(s.createdAt)}`);
  });
}

// 2. Check webhook handler idempotency
// Look for: Does it check if subscription already exists?
// Should use: findSubscriptionByStripeId() then update or create
```

### Solution

**Make Webhook Handler Idempotent**:

```typescript
// 1. Add idempotency key handling
const handleSubscriptionUpdated = async (ctx, stripeSubscription) => {
  // Find by Stripe ID (primary key)
  let subscription = await ctx.db
    .query("subscriptions")
    .filter(s => s.eq(s.field("stripeSubscriptionId"), stripeSubscription.id))
    .first();

  if (subscription) {
    // Update existing
    await ctx.db.patch(subscription._id, {
      status: stripeSubscription.status,
      renewalDate: new Date(stripeSubscription.current_period_end * 1000).getTime(),
      lastWebhookAt: Date.now()
    });
    return { action: "updated", subscriptionId: subscription._id };
  } else {
    // Create new only if doesn't exist
    subscription = await ctx.db.insert("subscriptions", {
      stripeSubscriptionId: stripeSubscription.id,
      userId: stripeSubscription.metadata.userId,
      planId: getPlanIdFromStripeId(stripeSubscription.items.data[0].price.id),
      status: stripeSubscription.status,
      createdAt: Date.now(),
      renewalDate: new Date(stripeSubscription.current_period_end * 1000).getTime()
    });
    return { action: "created", subscriptionId: subscription._id };
  }
};

// 2. Use Stripe idempotency keys
const result = await stripe.subscriptions.create(
  {
    customer: customerId,
    items: [{ price: priceId }]
  },
  {
    idempotencyKey: `upgrade-${userId}-${Date.now()}`
  }
);

// 3. Log all webhook attempts
await ctx.db.insert("webhookLog", {
  eventId: event.id,
  type: event.type,
  status: "processed",
  subscriptionId: subscription._id,
  processedAt: Date.now()
});

// 4. Check if already processed
const alreadyProcessed = await ctx.db.query("webhookLog")
  .filter(w => w.eq(w.field("eventId"), event.id))
  .first();

if (alreadyProcessed) {
  return { skipped: true, reason: "Already processed", eventId: event.id };
}
```

**Files to Check**:
- Stripe webhook handler - Add idempotency checks
- Database schema - Index on `stripeSubscriptionId` for fast lookups
- Verify handler uses findOrCreate pattern, not just create

---

## Summary of Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Payment declined | Card issues or insufficient funds | Show specific error, try different card |
| Credits not reset | Renewal job failed or timeout | Manually trigger renewal, add monitoring |
| Feature access | Missing credit check | Add validation before every operation |
| Webhook not received | Endpoint not configured | Register in Stripe dashboard |
| Wrong prorated amount | Calculation error | Fix timezone handling, use Stripe proration |
| Duplicate charges | Non-idempotent handler | Add findOrCreate logic, use idempotency keys |

**Testing Checklist**:
- ✅ Test payment with test card (4242424242424242)
- ✅ Test failed payment (4000000000000002)
- ✅ Test rate limiting (4000000000000341)
- ✅ Test webhook retry (Stripe can resend)
- ✅ Test proration calculation manually
- ✅ Test credit deduction race conditions
- ✅ Verify database transactions/atomicity
