import { env } from '../../config/env.js';
import type { IPaymentProvider } from './payment-provider.js';
import { PolarProvider } from './providers/polar.js';
import { StripeProvider } from './providers/stripe.js';

let cached: IPaymentProvider | null = null;
let override: IPaymentProvider | null = null;

function build(): IPaymentProvider {
  if (env.PAYMENT_PROVIDER === 'stripe') return new StripeProvider();
  // Default to Polar — including when PAYMENT_PROVIDER=none, so the module wires
  // deterministically even before the operator provisions the token. The
  // provider's isConfigured() gate stops real API calls until env is set.
  return new PolarProvider();
}

export function getPaymentProvider(): IPaymentProvider {
  if (override) return override;
  if (!cached) cached = build();
  return cached;
}

export function __setPaymentProviderForTests(provider: IPaymentProvider | null): void {
  override = provider;
  cached = null;
}
