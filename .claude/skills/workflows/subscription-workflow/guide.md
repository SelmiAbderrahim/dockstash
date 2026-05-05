# Subscription Workflow - Complete Implementation Guide

## Architecture Overview

The subscription workflow consists of 6 main phases:

```
┌──────────────────────┐
│ Plan Selection Phase │ (User chooses tier)
├──────────────────────┤
│ Payment Processing   │ (Stripe handles card)
├──────────────────────┤
│ Credit Allocation    │ (Monthly credits added)
├──────────────────────┤
│ Usage Tracking       │ (Credits deducted)
├──────────────────────┤
│ Renewal & Billing    │ (Monthly/annual refresh)
├──────────────────────┤
│ Lifecycle Management │ (Upgrade/downgrade/cancel)
└──────────────────────┘
```

---

## Phase 1: Plan Selection

### Display Available Plans

```typescript
export const getAvailablePlans = query({
  handler: async (ctx, args: { userId: Id<"users"> }) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    // Define all available plans
    const plans = [
      {
        id: "free",
        name: "Free",
        description: "Perfect for trying out iReadYouTube",
        price: 0,
        currency: "USD",
        creditsPerMonth: 100,
        maxVideos: 5,
        features: [
          "YouTube & file upload",
          "AI transcription",
          "Basic chat",
          "100 credits/month"
        ],
        billingPeriod: "monthly",
        stripeProductId: null
      },
      {
        id: "pro",
        name: "Pro",
        description: "For power users and small teams",
        price: 29.99,
        currency: "USD",
        creditsPerMonth: 5000,
        maxVideos: 500,
        features: [
          "Unlimited uploads",
          "AI transcription",
          "Advanced chat with web search",
          "Analytics dashboard",
          "Priority support",
          "5000 credits/month",
          "Conversation export"
        ],
        billingPeriod: "monthly",
        stripeProductId: "prod_pro_123",
        stripePriceId: "price_pro_monthly_123"
      },
      {
        id: "enterprise",
        name: "Enterprise",
        description: "For large organizations",
        price: null,
        currency: "USD",
        creditsPerMonth: null, // Custom
        maxVideos: null, // Unlimited
        features: [
          "Everything in Pro",
          "Custom credit limits",
          "API access",
          "Dedicated support",
          "Custom integrations",
          "SSO/SAML",
          "Annual billing"
        ],
        billingPeriod: "annual",
        stripeProductId: "prod_enterprise_123"
      }
    ];

    // Get user's current subscription
    const currentSubscription = await ctx.db
      .query("subscriptions")
      .filter(s => s.eq(s.field("userId"), user.subject))
      .first();

    return {
      plans,
      currentPlan: currentSubscription?.planId || "free",
      currentCredits: currentSubscription?.creditsAllowed || 0,
      creditsUsed: currentSubscription?.creditsUsed || 0
    };
  }
});
```

### Validate User Eligibility

```typescript
export const validatePlanEligibility = query({
  handler: async (ctx, args: { userId: Id<"users">; targetPlanId: string }) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    const subscription = await ctx.db
      .query("subscriptions")
      .filter(s => s.eq(s.field("userId"), user.subject))
      .first();

    const currentPlanId = subscription?.planId || "free";
    const targetPlanId = args.targetPlanId;

    // Check if upgrade/downgrade is valid
    const planHierarchy = ["free", "pro", "enterprise"];
    const currentIndex = planHierarchy.indexOf(currentPlanId);
    const targetIndex = planHierarchy.indexOf(targetPlanId);

    return {
      isEligible: true,
      currentPlan: currentPlanId,
      targetPlan: targetPlanId,
      isUpgrade: targetIndex > currentIndex,
      isDowngrade: targetIndex < currentIndex,
      upgradePrice: calculateUpgradePrice(currentPlanId, targetPlanId, subscription),
      requiresPaymentMethod: targetPlanId !== "free"
    };
  }
});

function calculateUpgradePrice(
  currentPlanId: string,
  targetPlanId: string,
  subscription: any
): number {
  const PLAN_PRICES = { free: 0, pro: 29.99, enterprise: 0 };

  const currentPrice = PLAN_PRICES[currentPlanId];
  const targetPrice = PLAN_PRICES[targetPlanId];
  const priceDifference = targetPrice - currentPrice;

  if (priceDifference <= 0) return 0; // Downgrade or same price

  // Calculate prorated amount for remaining days in billing cycle
  const daysRemaining = Math.ceil(
    (subscription.renewalDate - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const dailyRate = priceDifference / 30;
  const prorationAmount = dailyRate * daysRemaining;

  return Math.max(0, prorationAmount);
}
```

---

## Phase 2: Payment Processing

### Create Stripe Customer

```typescript
export const initializePayment = mutation({
  handler: async (ctx, args: { userId: Id<"users">; email: string }) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    // Check if Stripe customer exists
    let subscription = await ctx.db
      .query("subscriptions")
      .filter(s => s.eq(s.field("userId"), user.subject))
      .first();

    if (subscription?.stripeCustomerId) {
      return { stripeCustomerId: subscription.stripeCustomerId };
    }

    // Create Stripe customer via server action
    const stripeCustomer = await createStripeCustomer({
      email: args.email,
      metadata: { userId: user.subject }
    });

    // Store Stripe customer ID
    if (!subscription) {
      subscription = await ctx.db.insert("subscriptions", {
        userId: user.subject,
        planId: "free",
        creditsAllowed: 100,
        creditsUsed: 0,
        stripeCustomerId: stripeCustomer.id,
        status: "active",
        createdAt: Date.now(),
        renewalDate: addMonths(Date.now(), 1)
      });
    } else {
      await ctx.db.patch(subscription._id, {
        stripeCustomerId: stripeCustomer.id
      });
    }

    return { stripeCustomerId: stripeCustomer.id };
  }
});
```

### Process Payment Method

```typescript
export const attachPaymentMethod = mutation({
  handler: async (
    ctx,
    args: { userId: Id<"users">; stripePaymentMethodId: string }
  ) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    const subscription = await ctx.db
      .query("subscriptions")
      .filter(s => s.eq(s.field("userId"), user.subject))
      .first();

    if (!subscription?.stripeCustomerId) {
      throw new Error("No Stripe customer found");
    }

    // Attach payment method to Stripe customer
    await attachPaymentMethodToCustomer({
      customerId: subscription.stripeCustomerId,
      paymentMethodId: args.stripePaymentMethodId
    });

    return { success: true, lastFour: "****1234" };
  }
});
```

### Create Subscription in Stripe

```typescript
export const createSubscription = mutation({
  handler: async (
    ctx,
    args: { userId: Id<"users">; planId: string; paymentMethodId: string }
  ) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    try {
      const subscription = await ctx.db
        .query("subscriptions")
        .filter(s => s.eq(s.field("userId"), user.subject))
        .first();

      const PLAN_CONFIG = {
        pro: { stripePriceId: "price_pro_monthly_123", credits: 5000 },
        enterprise: { stripePriceId: "price_enterprise_annual_123", credits: null }
      };

      const planConfig = PLAN_CONFIG[args.planId];
      if (!planConfig) {
        throw new Error("Invalid plan");
      }

      // Create subscription in Stripe
      const stripeSubscription = await createStripeSubscription({
        customerId: subscription.stripeCustomerId,
        priceId: planConfig.stripePriceId,
        paymentMethodId: args.paymentMethodId,
        metadata: { userId: user.subject, planId: args.planId }
      });

      // Update subscription in database
      const newCredits = planConfig.credits || 5000;
      await ctx.db.patch(subscription._id, {
        planId: args.planId,
        stripeSubscriptionId: stripeSubscription.id,
        creditsAllowed: newCredits,
        creditsUsed: 0,
        status: "active",
        renewalDate: addMonths(
          new Date(stripeSubscription.current_period_end * 1000),
          0
        ),
        upgradedAt: Date.now()
      });

      return {
        success: true,
        subscriptionId: stripeSubscription.id,
        status: stripeSubscription.status,
        creditsAdded: newCredits
      };
    } catch (error) {
      if (error.message.includes("Your card was declined")) {
        throw new ConvexError({
          code: "PAYMENT_FAILED",
          message: "Your card was declined. Please try another payment method."
        });
      }

      if (error.message.includes("Your card has expired")) {
        throw new ConvexError({
          code: "PAYMENT_FAILED",
          message: "Your card has expired. Please update your payment method."
        });
      }

      throw new ConvexError({
        code: "PAYMENT_ERROR",
        message: "Payment processing failed. Please try again."
      });
    }
  }
});
```

---

## Phase 3: Credit Allocation

### Add Monthly Credits

```typescript
export const addMonthlyCredits = mutation({
  handler: async (ctx, args: { userId: Id<"users"> }) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    const subscription = await ctx.db
      .query("subscriptions")
      .filter(s => s.eq(s.field("userId"), user.subject))
      .first();

    if (!subscription) {
      throw new Error("No subscription found");
    }

    // Determine credits for plan
    const CREDIT_ALLOCATION = {
      free: 100,
      pro: 5000,
      enterprise: 0 // Custom - handle separately
    };

    const creditsToAdd = CREDIT_ALLOCATION[subscription.planId] || 0;

    // Reset credits and update renewal date
    const newRenewalDate = addMonths(Date.now(), 1);

    await ctx.db.patch(subscription._id, {
      creditsAllowed: creditsToAdd,
      creditsUsed: 0,
      renewalDate: newRenewalDate,
      lastRenewalAt: Date.now()
    });

    // Log for analytics
    await ctx.db.insert("billingHistory", {
      userId: user.subject,
      subscriptionId: subscription._id,
      type: "credit_reset",
      amount: creditsToAdd,
      description: `Monthly credits reset for ${subscription.planId} plan`,
      timestamp: Date.now()
    });

    return {
      success: true,
      creditsAdded: creditsToAdd,
      creditsTotal: creditsToAdd,
      nextRenewalDate: newRenewalDate
    };
  }
});
```

### Apply Credit Limits

```typescript
export const validateCreditLimits = query({
  handler: async (ctx, args: { userId: Id<"users">; requiredCredits: number }) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    const subscription = await ctx.db
      .query("subscriptions")
      .filter(s => s.eq(s.field("userId"), user.subject))
      .first();

    if (!subscription) {
      throw new Error("No subscription found");
    }

    const creditsUsed = subscription.creditsUsed || 0;
    const creditsRemaining = subscription.creditsAllowed - creditsUsed;

    return {
      canProceed: creditsRemaining >= args.requiredCredits,
      creditsRemaining,
      creditsRequired: args.requiredCredits,
      upgradeRequired: creditsRemaining < args.requiredCredits
    };
  }
});
```

---

## Phase 4: Usage Tracking

### Track and Deduct Credits

```typescript
export const deductCreditsForAction = mutation({
  handler: async (
    ctx,
    args: {
      userId: Id<"users">;
      actionType: "chat" | "transcription" | "export";
      costCredits: number;
    }
  ) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    const subscription = await ctx.db
      .query("subscriptions")
      .filter(s => s.eq(s.field("userId"), user.subject))
      .first();

    if (!subscription) {
      throw new Error("No subscription found");
    }

    // Check if enough credits
    const creditsUsed = subscription.creditsUsed || 0;
    const creditsRemaining = subscription.creditsAllowed - creditsUsed;

    if (creditsRemaining < args.costCredits) {
      throw new ConvexError({
        code: "INSUFFICIENT_CREDITS",
        message: `You need ${args.costCredits} credits but only have ${creditsRemaining}`,
        creditsRequired: args.costCredits,
        creditsAvailable: creditsRemaining
      });
    }

    // Deduct credits
    await ctx.db.patch(subscription._id, {
      creditsUsed: creditsUsed + args.costCredits
    });

    // Log usage
    await ctx.db.insert("usageLog", {
      userId: user.subject,
      subscriptionId: subscription._id,
      actionType: args.actionType,
      creditsDeducted: args.costCredits,
      timestamp: Date.now()
    });

    return {
      creditsDeducted: args.costCredits,
      creditsRemaining: creditsRemaining - args.costCredits,
      subscriptionId: subscription._id
    };
  }
});
```

### Get Usage Statistics

```typescript
export const getUserUsageStats = query({
  handler: async (ctx, args: { userId?: Id<"users">; timeframe?: "day" | "month" | "year" }) => {
    const user = await ctx.auth.getUserIdentity();
    const userId = args.userId || user.subject;

    const timeframe = args.timeframe || "month";
    const startDate = getTimeframeStart(timeframe);

    const usageLogs = await ctx.db
      .query("usageLog")
      .filter(u => u.eq(u.field("userId"), userId))
      .filter(u => u.gte(u.field("timestamp"), startDate))
      .collect();

    const subscription = await ctx.db
      .query("subscriptions")
      .filter(s => s.eq(s.field("userId"), userId))
      .first();

    // Calculate statistics
    const totalCreditsUsed = usageLogs.reduce((sum, log) => sum + log.creditsDeducted, 0);
    const byAction = usageLogs.reduce((acc, log) => {
      acc[log.actionType] = (acc[log.actionType] || 0) + 1;
      return acc;
    }, {});

    const creditsRemaining = (subscription?.creditsAllowed || 0) - (subscription?.creditsUsed || 0);
    const percentageUsed = subscription
      ? ((subscription.creditsUsed || 0) / subscription.creditsAllowed) * 100
      : 0;

    return {
      timeframe,
      totalCreditsUsed,
      byAction,
      creditsRemaining,
      percentageUsed: Math.round(percentageUsed),
      plan: subscription?.planId || "free",
      renewalDate: subscription?.renewalDate,
      lastAction: usageLogs.length > 0 ? Math.max(...usageLogs.map(l => l.timestamp)) : null
    };
  }
});

function getTimeframeStart(timeframe: string): number {
  const now = Date.now();
  switch (timeframe) {
    case "day":
      return now - 24 * 60 * 60 * 1000;
    case "month":
      return now - 30 * 24 * 60 * 60 * 1000;
    case "year":
      return now - 365 * 24 * 60 * 60 * 1000;
    default:
      return now - 30 * 24 * 60 * 60 * 1000;
  }
}
```

---

## Phase 5: Renewal & Billing

### Process Monthly Renewal

```typescript
export const processMonthlyRenewal = action({
  handler: async (ctx, args: { subscriptionId: Id<"subscriptions"> }) => {
    const subscription = await ctx.db.get(args.subscriptionId);

    if (!subscription.stripeSubscriptionId) {
      return { skipped: true, reason: "Free plan - no renewal" };
    }

    try {
      // Get Stripe subscription status
      const stripeSubscription = await getStripeSubscription(
        subscription.stripeSubscriptionId
      );

      if (stripeSubscription.status === "active") {
        // Reset credits for new month
        const CREDIT_ALLOCATION = {
          free: 100,
          pro: 5000,
          enterprise: 0
        };

        const newCredits = CREDIT_ALLOCATION[subscription.planId] || 0;

        await ctx.db.patch(subscription._id, {
          creditsAllowed: newCredits,
          creditsUsed: 0,
          renewalDate: addMonths(Date.now(), 1),
          lastRenewalAt: Date.now(),
          renewalStatus: "success"
        });

        // Log renewal
        await ctx.db.insert("billingHistory", {
          userId: subscription.userId,
          subscriptionId: subscription._id,
          type: "renewal_success",
          amount: stripeSubscription.current_period_start,
          description: "Monthly subscription renewed",
          timestamp: Date.now()
        });

        return {
          success: true,
          creditsReset: newCredits,
          nextRenewalDate: subscription.renewalDate
        };
      } else if (stripeSubscription.status === "past_due") {
        // Handle failed payment
        await ctx.db.patch(subscription._id, {
          status: "past_due",
          renewalStatus: "failed"
        });

        return { success: false, reason: "Payment failed - past due" };
      }
    } catch (error) {
      console.error("Renewal error:", error);
      return { success: false, error: String(error) };
    }
  }
});
```

### Handle Failed Payments

```typescript
export const handleFailedPayment = mutation({
  handler: async (
    ctx,
    args: { subscriptionId: string; paymentIntentId: string; errorMessage: string }
  ) => {
    // Find subscription by Stripe ID
    const subscription = await ctx.db
      .query("subscriptions")
      .filter(s => s.eq(s.field("stripeSubscriptionId"), args.subscriptionId))
      .first();

    if (!subscription) {
      return { found: false };
    }

    // Increment retry count
    const retryCount = (subscription.paymentRetries || 0) + 1;
    const maxRetries = 3;

    // Update subscription status
    await ctx.db.patch(subscription._id, {
      status: retryCount >= maxRetries ? "suspended" : "past_due",
      paymentRetries: retryCount,
      lastPaymentError: args.errorMessage,
      lastFailureAt: Date.now()
    });

    // Log failure
    await ctx.db.insert("billingHistory", {
      userId: subscription.userId,
      subscriptionId: subscription._id,
      type: "payment_failed",
      amount: 0,
      description: `Payment failed (attempt ${retryCount}/${maxRetries}): ${args.errorMessage}`,
      timestamp: Date.now()
    });

    // Send notification email if max retries reached
    if (retryCount >= maxRetries) {
      await sendEmail({
        to: subscription.userId,
        template: "payment_failed_final",
        context: {
          retries: maxRetries,
          planName: subscription.planId,
          actionUrl: "https://ireadyoutube.com/billing"
        }
      });
    }

    return {
      success: true,
      retryCount,
      maxRetries,
      suspended: retryCount >= maxRetries
    };
  }
});
```

---

## Phase 6: Lifecycle Management

### Handle Plan Upgrade

```typescript
export const upgradePlan = mutation({
  handler: async (
    ctx,
    args: { userId: Id<"users">; newPlanId: string; paymentMethodId?: string }
  ) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    const subscription = await ctx.db
      .query("subscriptions")
      .filter(s => s.eq(s.field("userId"), user.subject))
      .first();

    if (!subscription) {
      throw new Error("No subscription found");
    }

    const currentPlanId = subscription.planId;

    // Validate upgrade path
    if (!isValidUpgrade(currentPlanId, args.newPlanId)) {
      throw new Error("Invalid upgrade path");
    }

    // Calculate proration
    const prorationAmount = calculateUpgradeProration(
      currentPlanId,
      args.newPlanId,
      subscription.renewalDate
    );

    // Update Stripe subscription if paid plan
    if (args.newPlanId !== "free") {
      const PLAN_CONFIG = {
        pro: { stripePriceId: "price_pro_monthly_123", credits: 5000 },
        enterprise: { stripePriceId: "price_enterprise_annual_123", credits: null }
      };

      const config = PLAN_CONFIG[args.newPlanId];
      const stripeSubscription = await updateStripeSubscription({
        subscriptionId: subscription.stripeSubscriptionId,
        priceId: config.stripePriceId,
        prorationBehavior: "create_prorations"
      });

      // Charge prorated amount if upgrade
      if (prorationAmount > 0) {
        await chargePaymentMethod({
          customerId: subscription.stripeCustomerId,
          amount: Math.round(prorationAmount * 100), // Convert to cents
          currency: "usd",
          description: `Proration for upgrade from ${currentPlanId} to ${args.newPlanId}`
        });
      }
    }

    // Update subscription with new plan
    const newCredits = PLAN_CREDITS[args.newPlanId] || 100;
    await ctx.db.patch(subscription._id, {
      planId: args.newPlanId,
      creditsAllowed: newCredits,
      creditsUsed: 0,
      upgradedAt: Date.now(),
      renewalDate: addMonths(Date.now(), getPlanBillingMonths(args.newPlanId))
    });

    // Log upgrade
    await ctx.db.insert("billingHistory", {
      userId: user.subject,
      subscriptionId: subscription._id,
      type: "upgrade",
      amount: prorationAmount,
      description: `Upgraded from ${currentPlanId} to ${args.newPlanId}`,
      timestamp: Date.now()
    });

    return {
      success: true,
      oldPlan: currentPlanId,
      newPlan: args.newPlanId,
      prorationAmount,
      creditsAdded: newCredits
    };
  }
});

function isValidUpgrade(currentPlan: string, newPlan: string): boolean {
  const hierarchy = ["free", "pro", "enterprise"];
  return hierarchy.indexOf(newPlan) > hierarchy.indexOf(currentPlan);
}

function calculateUpgradeProration(
  currentPlan: string,
  newPlan: string,
  renewalDate: number
): number {
  const PRICES = { free: 0, pro: 29.99, enterprise: 0 };
  const daysRemaining = Math.ceil((renewalDate - Date.now()) / (1000 * 60 * 60 * 24));
  const priceDifference = (PRICES[newPlan] || 0) - (PRICES[currentPlan] || 0);
  const dailyRate = priceDifference / 30;
  return Math.max(0, dailyRate * daysRemaining);
}
```

### Handle Plan Downgrade

```typescript
export const downgradePlan = mutation({
  handler: async (ctx, args: { userId: Id<"users">; newPlanId: string }) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    const subscription = await ctx.db
      .query("subscriptions")
      .filter(s => s.eq(s.field("userId"), user.subject))
      .first();

    // Downgrades take effect at next renewal (not immediate)
    await ctx.db.patch(subscription._id, {
      pendingPlanId: args.newPlanId,
      downgradeScheduledAt: Date.now(),
      downgradeEffectiveAt: subscription.renewalDate
    });

    // Log downgrade
    await ctx.db.insert("billingHistory", {
      userId: user.subject,
      subscriptionId: subscription._id,
      type: "downgrade_scheduled",
      amount: 0,
      description: `Downgrade to ${args.newPlanId} scheduled for ${new Date(subscription.renewalDate).toLocaleDateString()}`,
      timestamp: Date.now()
    });

    return {
      success: true,
      currentPlan: subscription.planId,
      downgradePlan: args.newPlanId,
      effectiveDate: subscription.renewalDate
    };
  }
});
```

### Handle Cancellation

```typescript
export const cancelSubscription = mutation({
  handler: async (
    ctx,
    args: { userId: Id<"users">; reason?: string; cancellationDate?: "immediately" | "at_period_end" }
  ) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    const subscription = await ctx.db
      .query("subscriptions")
      .filter(s => s.eq(s.field("userId"), user.subject))
      .first();

    const cancellationDate = args.cancellationDate || "at_period_end";
    const effectiveDate =
      cancellationDate === "immediately" ? Date.now() : subscription.renewalDate;

    // Cancel Stripe subscription
    if (subscription.stripeSubscriptionId) {
      await cancelStripeSubscription({
        subscriptionId: subscription.stripeSubscriptionId,
        atPeriodEnd: cancellationDate === "at_period_end"
      });
    }

    // Update subscription status
    await ctx.db.patch(subscription._id, {
      status: "canceled",
      canceledAt: Date.now(),
      cancelationReason: args.reason,
      cancelationEffectiveDate: effectiveDate,
      creditsAllowed: 0,
      creditsUsed: 0
    });

    // Log cancellation
    await ctx.db.insert("billingHistory", {
      userId: user.subject,
      subscriptionId: subscription._id,
      type: "cancellation",
      amount: 0,
      description: `Subscription canceled${args.reason ? ` - ${args.reason}` : ""}`,
      timestamp: Date.now()
    });

    return {
      success: true,
      canceledAt: Date.now(),
      effectiveDate
    };
  }
});
```

---

## Stripe Webhook Handler

### Process Stripe Events

```typescript
export const handleStripeWebhook = action({
  handler: async (ctx, args: { event: any; signature: string }) => {
    // Verify webhook signature
    const isValid = verifyStripeSignature(args.event, args.signature);
    if (!isValid) {
      throw new Error("Invalid webhook signature");
    }

    const event = args.event;

    switch (event.type) {
      case "customer.subscription.updated":
        return await handleSubscriptionUpdated(ctx, event.data.object);

      case "invoice.payment_succeeded":
        return await handlePaymentSucceeded(ctx, event.data.object);

      case "invoice.payment_failed":
        return await handlePaymentFailed(ctx, event.data.object);

      case "customer.subscription.deleted":
        return await handleSubscriptionDeleted(ctx, event.data.object);

      default:
        return { handled: false, type: event.type };
    }
  }
});

async function handleSubscriptionUpdated(ctx: any, stripeSubscription: any) {
  const subscription = await ctx.db
    .query("subscriptions")
    .filter(s => s.eq(s.field("stripeSubscriptionId"), stripeSubscription.id))
    .first();

  if (subscription) {
    await ctx.db.patch(subscription._id, {
      status: stripeSubscription.status,
      renewalDate: new Date(stripeSubscription.current_period_end * 1000).getTime()
    });
  }

  return { handled: true };
}

async function handlePaymentSucceeded(ctx: any, invoice: any) {
  const subscription = await ctx.db
    .query("subscriptions")
    .filter(s => s.eq(s.field("stripeSubscriptionId"), invoice.subscription))
    .first();

  if (subscription) {
    // Reset payment retries
    await ctx.db.patch(subscription._id, {
      status: "active",
      paymentRetries: 0,
      lastPaymentAt: Date.now()
    });

    // Reset credits for new period
    const CREDITS = { free: 100, pro: 5000, enterprise: 0 };
    await ctx.db.patch(subscription._id, {
      creditsAllowed: CREDITS[subscription.planId] || 0,
      creditsUsed: 0
    });
  }

  return { handled: true };
}

async function handlePaymentFailed(ctx: any, invoice: any) {
  await handleFailedPayment(ctx, {
    subscriptionId: invoice.subscription,
    paymentIntentId: invoice.payment_intent,
    errorMessage: invoice.last_payment_error?.message || "Unknown error"
  });

  return { handled: true };
}

async function handleSubscriptionDeleted(ctx: any, stripeSubscription: any) {
  const subscription = await ctx.db
    .query("subscriptions")
    .filter(s => s.eq(s.field("stripeSubscriptionId"), stripeSubscription.id))
    .first();

  if (subscription) {
    await ctx.db.patch(subscription._id, {
      status: "canceled",
      canceledAt: Date.now()
    });
  }

  return { handled: true };
}
```

---

## Key Helper Functions

```typescript
function addMonths(date: Date | number, months: number): number {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

function getPlanBillingMonths(planId: string): number {
  const billingMonths = {
    free: 1,
    pro: 1,
    enterprise: 12
  };
  return billingMonths[planId] || 1;
}

const PLAN_CREDITS = {
  free: 100,
  pro: 5000,
  enterprise: 0
};

async function createStripeCustomer(options: any) {
  // Call Stripe API
  return {}; // Placeholder
}

async function getStripeSubscription(subscriptionId: string) {
  // Call Stripe API
  return {}; // Placeholder
}

async function updateStripeSubscription(options: any) {
  // Call Stripe API
  return {}; // Placeholder
}

async function cancelStripeSubscription(options: any) {
  // Call Stripe API
  return {}; // Placeholder
}
```
