import { env } from '../../config/env.js';

// Legacy Stripe presence probe kept alive for callers still on the pre-refactor
// billing surface. The Stripe adapter (providers/stripe.ts) is inactive by
// default; use `getPaymentProvider()` to reach the active provider (Polar).
export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}
