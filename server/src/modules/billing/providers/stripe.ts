import { env } from '../../../config/env.js';
import { HttpError } from '../../../shared/utils/http-error.js';
import type {
  ChangePlanInput,
  CreateCheckoutInput,
  CreateCheckoutResult,
  IPaymentProvider,
  NormalizedSubscription,
  OpenPortalInput,
  OpenPortalResult,
  ParsedEvent,
  WebhookHeaders,
} from '../payment-provider.js';
import { WebhookVerifyError } from '../payment-provider.js';

// Stripe adapter — kept for multi-provider capability. INACTIVE by default:
// PAYMENT_PROVIDER=polar is the shipping default. Every operation throws
// `not-implemented` so accidental use fails loud rather than silently drifting
// state. Implementers can port the pre-refactor `billing.service.ts` logic in
// here behind these method bodies when Stripe is re-enabled.

function inactive(op: string): never {
  throw HttpError.internal(
    `Stripe payment provider is inactive (attempted ${op}). Set PAYMENT_PROVIDER=stripe and implement the adapter.`,
  );
}

export class StripeProvider implements IPaymentProvider {
  public readonly name = 'stripe' as const;

  isConfigured(): boolean {
    return env.PAYMENT_PROVIDER === 'stripe' && Boolean(env.STRIPE_SECRET_KEY);
  }

  async createCheckout(_input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    inactive('createCheckout');
  }

  async openPortal(_input: OpenPortalInput): Promise<OpenPortalResult> {
    inactive('openPortal');
  }

  async changePlan(_input: ChangePlanInput): Promise<NormalizedSubscription> {
    inactive('changePlan');
  }

  verifyWebhook(_rawBody: Buffer, _headers: WebhookHeaders): void {
    throw new WebhookVerifyError('stripe adapter inactive', 501);
  }

  parseEvent(_rawBody: Buffer, _headers: WebhookHeaders): ParsedEvent {
    throw new WebhookVerifyError('stripe adapter inactive', 501);
  }

  async listActiveSubscriptions(): Promise<NormalizedSubscription[]> {
    return [];
  }
}
