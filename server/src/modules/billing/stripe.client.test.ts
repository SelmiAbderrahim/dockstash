import { afterEach, describe, expect, it } from 'vitest';
import { env } from '../../config/env.js';
import { isStripeConfigured } from './stripe.client.js';
import { StripeProvider } from './providers/stripe.js';

type EnvMutable = Record<string, string | undefined>;

describe('stripe.client / isStripeConfigured', () => {
  afterEach(() => {
    (env as unknown as EnvMutable).STRIPE_SECRET_KEY = undefined;
  });

  it('is true when STRIPE_SECRET_KEY is set', () => {
    (env as unknown as EnvMutable).STRIPE_SECRET_KEY = 'sk_test_123';
    expect(isStripeConfigured()).toBe(true);
  });

  it('is false when STRIPE_SECRET_KEY is unset', () => {
    (env as unknown as EnvMutable).STRIPE_SECRET_KEY = undefined;
    expect(isStripeConfigured()).toBe(false);
  });

  it('StripeProvider.isConfigured mirrors the env key', () => {
    const provider = new StripeProvider();
    (env as unknown as EnvMutable).STRIPE_SECRET_KEY = 'sk_test_abc';
    expect(provider.isConfigured()).toBe(true);
    (env as unknown as EnvMutable).STRIPE_SECRET_KEY = undefined;
    expect(provider.isConfigured()).toBe(false);
  });
});
