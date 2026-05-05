import Stripe from 'stripe';
import { env } from '../../config/env.js';
import { HttpError } from '../../shared/utils/http-error.js';

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw HttpError.internal('Stripe is not configured (missing STRIPE_SECRET_KEY).');
  }
  if (!cached) {
    cached = new Stripe(env.STRIPE_SECRET_KEY, { timeout: 20_000 });
  }
  return cached;
}

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}
