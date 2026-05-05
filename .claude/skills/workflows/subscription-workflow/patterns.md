# Subscription Workflow - Advanced Patterns

## Pattern 1: Multi-Currency Billing with Exchange Rates

Handle billing in multiple currencies with real-time exchange rates:

```typescript
export const getCountryAndCurrency = query({
  handler: async (ctx, args: { userId: Id<"users"> }) => {
    const user = await ctx.auth.getUserIdentity();

    // Detect user's country from IP or profile
    const country = await detectUserCountry(user);
    const currency = getCurrencyForCountry(country);

    // Get exchange rates from cache (updated hourly)
    const rates = await getExchangeRates("USD", currency);

    return {
      country,
      currency,
      exchangeRate: rates[currency],
      updatedAt: rates.timestamp
    };
  }
});

export const getPricingInUserCurrency = query({
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    const { currency, exchangeRate } = await getCountryAndCurrency(ctx, { userId: user.subject });

    // Base prices in USD
    const basePrices = {
      pro: 29.99,
      enterprise: 299.99
    };

    // Convert to user's currency
    const localPrices = {
      pro: (basePrices.pro * exchangeRate).toFixed(2),
      enterprise: (basePrices.enterprise * exchangeRate).toFixed(2)
    };

    // Format for display (e.g., "€27.95" for EUR)
    return {
      pro: formatCurrencyDisplay(localPrices.pro, currency),
      enterprise: formatCurrencyDisplay(localPrices.enterprise, currency),
      currency
    };
  }
});

// Stripe handles actual currency conversion via payment intent
function getCurrencyForCountry(country: string): string {
  const currencyMap = {
    US: "USD", GB: "GBP", DE: "EUR", FR: "EUR", JP: "JPY",
    AU: "AUD", CA: "CAD", SG: "SGD", IN: "INR", BR: "BRL"
  };
  return currencyMap[country] || "USD";
}

function formatCurrencyDisplay(amount: string, currency: string): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  });
  return formatter.format(parseFloat(amount));
}

// Cache exchange rates (update every hour)
async function getExchangeRates(baseCurrency: string, targetCurrency: string) {
  const cacheKey = `exchange_rates_${baseCurrency}`;
  const cached = await ctx.kvStore.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) {
    return cached;
  }

  // Fetch from external API (e.g., Open Exchange Rates)
  const rates = await fetchExchangeRates(baseCurrency);
  await ctx.kvStore.set(cacheKey, { ...rates, timestamp: Date.now() });

  return rates;
}
```

---

## Pattern 2: Flexible Credit Rollover and Expiration

Implement credit rollover with partial carryover and expiration dates:

```typescript
export const manageCreditRollover = mutation({
  handler: async (ctx, args: { userId: Id<"users"> }) => {
    const user = await ctx.auth.getUserIdentity();
    const subscription = await ctx.db
      .query("subscriptions")
      .filter(s => s.eq(s.field("userId"), user.subject))
      .first();

    if (!subscription) throw new Error("No subscription");

    // Define rollover policy per plan
    const ROLLOVER_POLICY = {
      free: { carryoverPercent: 0, expirationDays: 30 },    // No rollover
      pro: { carryoverPercent: 0.25, expirationDays: 60 },  // Keep 25% for 60 days
      enterprise: { carryoverPercent: 1.0, expirationDays: 90 } // Keep all for 90 days
    };

    const policy = ROLLOVER_POLICY[subscription.planId];
    const unusedCredits = (subscription.creditsAllowed || 0) - (subscription.creditsUsed || 0);
    const carryoverCredits = Math.floor(unusedCredits * policy.carryoverPercent);
    const newAllowance = getMonthlyAllowance(subscription.planId);

    // Update subscription with rollover
    const expirationDate = addDays(Date.now(), policy.expirationDays);

    await ctx.db.patch(subscription._id, {
      creditsAllowed: newAllowance + carryoverCredits,
      creditsUsed: 0,
      carryoverCredits,
      carryoverExpirationDate: expirationDate,
      renewalDate: addMonths(Date.now(), 1),
      lastRenewalAt: Date.now()
    });

    // Log rollover
    await ctx.db.insert("creditHistory", {
      userId: user.subject,
      subscriptionId: subscription._id,
      type: "rollover",
      amount: carryoverCredits,
      description: `Rollover: ${carryoverCredits} credits carried to next month (expires ${new Date(expirationDate).toLocaleDateString()})`,
      timestamp: Date.now()
    });

    return {
      newMonthlyAllowance: newAllowance,
      carryoverCredits,
      totalAvailable: newAllowance + carryoverCredits,
      carryoverExpires: expirationDate
    };
  }
});

export const deductCreditsWithExpiration = mutation({
  handler: async (
    ctx,
    args: { userId: Id<"users">; creditsNeeded: number }
  ) => {
    const user = await ctx.auth.getUserIdentity();
    const subscription = await ctx.db
      .query("subscriptions")
      .filter(s => s.eq(s.field("userId"), user.subject))
      .first();

    // Check if carryover credits expired
    if (subscription.carryoverExpirationDate &&
        Date.now() > subscription.carryoverExpirationDate) {
      // Remove expired carryover
      subscription.carryoverCredits = 0;
      await ctx.db.patch(subscription._id, {
        carryoverCredits: 0,
        carryoverExpirationDate: null
      });
    }

    const totalAvailable = (subscription.creditsAllowed || 0) - (subscription.creditsUsed || 0);

    if (totalAvailable < args.creditsNeeded) {
      throw new ConvexError({
        code: "INSUFFICIENT_CREDITS",
        message: `Need ${args.creditsNeeded} but only have ${totalAvailable}`
      });
    }

    // Deduct from regular credits first, then carryover
    const regularCreditsToUse = Math.min(
      args.creditsNeeded,
      (subscription.creditsAllowed - subscription.carryoverCredits) - (subscription.creditsUsed || 0)
    );
    const carryoverToUse = args.creditsNeeded - regularCreditsToUse;

    await ctx.db.patch(subscription._id, {
      creditsUsed: (subscription.creditsUsed || 0) + regularCreditsToUse,
      carryoverCredits: Math.max(0, subscription.carryoverCredits - carryoverToUse)
    });

    return {
      deducted: args.creditsNeeded,
      fromMonthly: regularCreditsToUse,
      fromCarryover: carryoverToUse,
      remaining: totalAvailable - args.creditsNeeded
    };
  }
});

function addDays(date: Date | number, days: number): number {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.getTime();
}
```

---

## Pattern 3: Prorated Billing with Mid-Month Changes

Calculate and apply prorated charges for mid-month upgrade/downgrade:

```typescript
export const calculateProration = query({
  handler: async (
    ctx,
    args: {
      currentPlanId: string;
      newPlanId: string;
      cycleStartDate: number;
      cycleEndDate: number;
    }
  ) => {
    const PLAN_PRICES = { free: 0, pro: 29.99, enterprise: 299.99 };
    const currentPrice = PLAN_PRICES[args.currentPlanId];
    const newPrice = PLAN_PRICES[args.newPlanId];

    const cycleDays = Math.ceil(
      (args.cycleEndDate - args.cycleStartDate) / (1000 * 60 * 60 * 24)
    );
    const daysUsed = Math.ceil(
      (Date.now() - args.cycleStartDate) / (1000 * 60 * 60 * 24)
    );
    const daysRemaining = cycleDays - daysUsed;

    // Calculate daily rates
    const currentDailyRate = currentPrice / cycleDays;
    const newDailyRate = newPrice / cycleDays;

    // Calculate credits
    const creditUsedForCurrentPlan = currentDailyRate * daysUsed;
    const creditOwedForNewPlan = newDailyRate * cycleDays;

    // Calculate proration amount (positive = charge, negative = credit)
    const prorationAmount = creditOwedForNewPlan - creditUsedForCurrentPlan;

    return {
      isUpgrade: newPrice > currentPrice,
      isDowngrade: newPrice < currentPrice,
      cycleDays,
      daysUsed,
      daysRemaining,
      currentDailyRate: currentDailyRate.toFixed(2),
      newDailyRate: newDailyRate.toFixed(2),
      creditUsedForCurrentPlan: creditUsedForCurrentPlan.toFixed(2),
      creditOwedForNewPlan: creditOwedForNewPlan.toFixed(2),
      prorationAmount: prorationAmount.toFixed(2),
      chargeNow: Math.max(0, prorationAmount),
      creditToApply: Math.max(0, -prorationAmount)
    };
  }
});

export const applyProration = mutation({
  handler: async (
    ctx,
    args: {
      userId: Id<"users">;
      currentPlanId: string;
      newPlanId: string;
      prorationAmount: number;
    }
  ) => {
    const user = await ctx.auth.getUserIdentity();
    const subscription = await ctx.db
      .query("subscriptions")
      .filter(s => s.eq(s.field("userId"), user.subject))
      .first();

    // Process charge or credit
    if (args.prorationAmount > 0) {
      // Charge customer
      await chargeViaStripe({
        customerId: subscription.stripeCustomerId,
        amount: Math.round(args.prorationAmount * 100),
        description: `Proration for upgrade from ${args.currentPlanId} to ${args.newPlanId}`
      });
    } else if (args.prorationAmount < 0) {
      // Issue credit to account
      const creditAmount = Math.abs(args.prorationAmount);
      await ctx.db.patch(subscription._id, {
        accountCredit: (subscription.accountCredit || 0) + creditAmount
      });
    }

    // Update plan
    const newCredits = getMonthlyAllowance(args.newPlanId);
    await ctx.db.patch(subscription._id, {
      planId: args.newPlanId,
      creditsAllowed: newCredits,
      creditsUsed: 0,
      upgradedAt: Date.now(),
      renewalDate: subscription.renewalDate // Keep same cycle end date
    });

    // Log proration
    await ctx.db.insert("billingHistory", {
      userId: user.subject,
      subscriptionId: subscription._id,
      type: "proration",
      amount: args.prorationAmount,
      description: `Proration for ${args.currentPlanId} → ${args.newPlanId}: ${
        args.prorationAmount > 0 ? "charge" : "credit"
      } $${Math.abs(args.prorationAmount).toFixed(2)}`,
      timestamp: Date.now()
    });

    return { success: true, prorationApplied: args.prorationAmount };
  }
});

function getMonthlyAllowance(planId: string): number {
  const allowances = { free: 100, pro: 5000, enterprise: 0 };
  return allowances[planId] || 0;
}
```

---

## Pattern 4: Smart Credit Estimation and Budgeting

Pre-calculate costs and show warnings before expensive operations:

```typescript
export const estimateOperationCost = query({
  handler: async (
    ctx,
    args: {
      operationType: "transcription" | "chat" | "export";
      metadata: { transcriptionMinutes?: number; messageCount?: number };
    }
  ) => {
    const costCalculators = {
      transcription: (metadata) => {
        // Cost: $0.000012 per minute = ~12 credits per minute
        const minutes = metadata.transcriptionMinutes || 30;
        return Math.ceil(minutes * 12);
      },
      chat: (metadata) => {
        // Cost: ~500 credits per message
        return 500;
      },
      export: (metadata) => {
        // Cost: ~100 credits per export
        return 100;
      }
    };

    const estimatedCost = costCalculators[args.operationType](args.metadata);

    const user = await ctx.auth.getUserIdentity();
    const subscription = await ctx.db
      .query("subscriptions")
      .filter(s => s.eq(s.field("userId"), user.subject))
      .first();

    const creditsAvailable = (subscription?.creditsAllowed || 0) - (subscription?.creditsUsed || 0);
    const willExceed = creditsAvailable < estimatedCost;

    // Calculate how much they'd need to upgrade
    let suggestedUpgrade = null;
    if (willExceed && subscription?.planId === "free") {
      suggestedUpgrade = {
        planId: "pro",
        monthlyCost: 29.99,
        creditsPerMonth: 5000,
        estimatedMonthlyUsage: estimatedCost,
        sufficient: 5000 >= estimatedCost
      };
    }

    return {
      operationType: args.operationType,
      estimatedCost,
      creditsAvailable,
      willExceed,
      percentOfMonthlyAllowance: subscription
        ? Math.round((estimatedCost / (subscription.creditsAllowed || 100)) * 100)
        : 0,
      suggestedUpgrade
    };
  }
});

export const showCreditWarning = query({
  handler: async (ctx, args: { userId: Id<"users">; threshold?: number }) => {
    const user = await ctx.auth.getUserIdentity();
    const subscription = await ctx.db
      .query("subscriptions")
      .filter(s => s.eq(s.field("userId"), user.subject))
      .first();

    const threshold = args.threshold || 0.2; // 20% remaining
    const creditsAvailable = (subscription?.creditsAllowed || 0) - (subscription?.creditsUsed || 0);
    const percentRemaining = subscription
      ? (creditsAvailable / (subscription.creditsAllowed || 100))
      : 1;

    return {
      shouldWarn: percentRemaining <= threshold,
      creditsRemaining: creditsAvailable,
      percentRemaining: Math.round(percentRemaining * 100),
      daysUntilRenewal: subscription
        ? Math.ceil((subscription.renewalDate - Date.now()) / (1000 * 60 * 60 * 24))
        : 0,
      warningMessage: percentRemaining <= threshold
        ? `You have ${creditsAvailable} credits remaining. Upgrade your plan to get more.`
        : null
    };
  }
});
```

---

## Pattern 5: Dunning Management for Failed Payments

Intelligently retry failed payments with escalating communication:

```typescript
export const manageDunning = mutation({
  handler: async (
    ctx,
    args: { subscriptionId: Id<"subscriptions"> }
  ) => {
    const subscription = await ctx.db.get(args.subscriptionId);

    if (!subscription.stripeSubscriptionId) {
      return { skipped: true, reason: "Free plan" };
    }

    const DUNNING_SCHEDULE = [
      { day: 0, action: "email", subject: "Payment Failed" },
      { day: 3, action: "email", subject: "Payment Failed - Retry Required" },
      { day: 5, action: "email_urgent", subject: "Urgent: Subscription Expiring" },
      { day: 7, action: "suspend", subject: "Subscription Suspended" },
      { day: 14, action: "cancel", subject: "Subscription Canceled" }
    ];

    const lastFailureAge = Math.floor(
      (Date.now() - (subscription.lastFailureAt || 0)) / (1000 * 60 * 60 * 24)
    );

    const nextAction = DUNNING_SCHEDULE.find(s => s.day === lastFailureAge);

    if (!nextAction) {
      return { skipped: true };
    }

    switch (nextAction.action) {
      case "email":
        await sendEmail({
          to: subscription.userId,
          template: "payment_failed",
          subject: nextAction.subject
        });
        return { action: "email_sent" };

      case "email_urgent":
        await sendEmail({
          to: subscription.userId,
          template: "payment_failed_urgent",
          subject: nextAction.subject,
          context: { updatePaymentUrl: "..." }
        });
        return { action: "urgent_email_sent" };

      case "suspend":
        await ctx.db.patch(args.subscriptionId, {
          status: "suspended",
          creditsAllowed: 0
        });

        await sendEmail({
          to: subscription.userId,
          template: "subscription_suspended",
          subject: nextAction.subject
        });

        return { action: "suspended", daysBeforeCancel: 7 };

      case "cancel":
        await cancelStripeSubscription({
          subscriptionId: subscription.stripeSubscriptionId,
          atPeriodEnd: false
        });

        await ctx.db.patch(args.subscriptionId, {
          status: "canceled",
          canceledAt: Date.now(),
          cancelationReason: "Payment failed - dunning limit exceeded"
        });

        await sendEmail({
          to: subscription.userId,
          template: "subscription_canceled",
          subject: nextAction.subject
        });

        return { action: "canceled" };
    }
  }
});

// Retry payment with exponential backoff
export const retryFailedPayment = action({
  handler: async (ctx, args: { subscriptionId: Id<"subscriptions"> }) => {
    const subscription = await ctx.db.get(args.subscriptionId);

    const retryCount = subscription.paymentRetries || 0;
    const backoffDays = Math.pow(2, Math.min(retryCount, 3)); // 1, 2, 4, 8+ days

    // Schedule retry
    await scheduleTask({
      type: "retry_payment",
      subscriptionId: args.subscriptionId,
      executeAt: Date.now() + backoffDays * 24 * 60 * 60 * 1000
    });

    return {
      scheduled: true,
      retryAttempt: retryCount + 1,
      retryAt: new Date(Date.now() + backoffDays * 24 * 60 * 60 * 1000)
    };
  }
});
```

---

## Pattern 6: Usage-Based Overage Charges

Charge for usage beyond monthly allowance:

```typescript
export const processMonthlyOverages = action({
  handler: async (ctx, args: { subscriptionId: Id<"subscriptions"> }) => {
    const subscription = await ctx.db.get(args.subscriptionId);

    if (subscription.planId === "enterprise") {
      return { skipped: true, reason: "Enterprise - custom billing" };
    }

    const OVERAGE_RATES = {
      free: 0.01, // $0.01 per credit
      pro: 0.005, // $0.005 per credit
      enterprise: 0 // No overages
    };

    const creditsUsed = subscription.creditsUsed || 0;
    const creditsAllowed = subscription.creditsAllowed || 0;
    const overage = Math.max(0, creditsUsed - creditsAllowed);

    if (overage === 0) {
      return { skipped: true, reason: "No overages" };
    }

    const overageRate = OVERAGE_RATES[subscription.planId];
    const overageCharge = overage * overageRate;

    // Charge via Stripe
    const invoice = await createStripeInvoice({
      customerId: subscription.stripeCustomerId,
      items: [
        {
          description: `Overage charges (${overage} credits × $${overageRate})`,
          amount: Math.round(overageCharge * 100)
        }
      ]
    });

    // Log overage
    await ctx.db.insert("billingHistory", {
      userId: subscription.userId,
      subscriptionId: subscription._id,
      type: "overage",
      amount: overageCharge,
      description: `Overage charge: ${overage} credits × $${overageRate}/credit`,
      timestamp: Date.now()
    });

    // Charge payment method
    await chargePaymentMethod({
      customerId: subscription.stripeCustomerId,
      amount: Math.round(overageCharge * 100),
      description: `Overage charges for ${new Date().toLocaleDateString()}`
    });

    return {
      overageCredits: overage,
      overageRate: `$${overageRate}`,
      totalCharge: `$${overageCharge.toFixed(2)}`,
      invoiceId: invoice.id
    };
  }
});

export const showOverageWarning = query({
  handler: async (ctx, args: { userId: Id<"users"> }) => {
    const user = await ctx.auth.getUserIdentity();
    const subscription = await ctx.db
      .query("subscriptions")
      .filter(s => s.eq(s.field("userId"), user.subject))
      .first();

    if (!subscription || subscription.planId === "enterprise") {
      return { hasOverages: false };
    }

    const creditsUsed = subscription.creditsUsed || 0;
    const creditsAllowed = subscription.creditsAllowed || 0;
    const overage = Math.max(0, creditsUsed - creditsAllowed);

    const OVERAGE_RATES = { free: 0.01, pro: 0.005 };
    const projectedCost = overage * OVERAGE_RATES[subscription.planId];

    return {
      hasOverages: overage > 0,
      overageCredits: overage,
      projectedCost: `$${projectedCost.toFixed(2)}`,
      warningMessage: `You've used ${overage} extra credits. You'll be charged $${projectedCost.toFixed(2)} at month end.`
    };
  }
});
```

---

## Summary of Patterns

| Pattern | Use Case | Complexity |
|---------|----------|-----------|
| **Multi-Currency** | Global billing support | High |
| **Credit Rollover** | Flexible credit expiration | Medium |
| **Proration** | Mid-month plan changes | High |
| **Cost Estimation** | Budget warnings | Medium |
| **Dunning** | Failed payment recovery | High |
| **Overages** | Usage-based billing | Medium |
