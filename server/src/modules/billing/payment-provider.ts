import type { PaymentProviderName } from './customer.model.js';

export type NormalizedSubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'revoked'
  | 'trialing'
  | 'incomplete';

export interface CreateCheckoutInput {
  productId: string;
  userId: string;
  email: string;
  successUrl: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

export interface CreateCheckoutResult {
  url: string;
  providerCheckoutId: string;
}

export interface OpenPortalInput {
  providerCustomerId: string;
}

export interface OpenPortalResult {
  url: string;
}

export interface ChangePlanInput {
  providerSubscriptionId: string;
  productId: string;
}

export interface NormalizedCustomer {
  providerCustomerId: string;
  email: string;
  externalId?: string;
}

export interface NormalizedSubscription {
  providerSubscriptionId: string;
  providerCustomerId: string;
  externalCustomerId?: string;
  productId: string;
  status: NormalizedSubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
}

export interface NormalizedOrder {
  providerOrderId: string;
  providerCustomerId: string;
  providerSubscriptionId?: string;
  externalCustomerId?: string;
  amount: number;
  currency: string;
  status: 'paid' | 'refunded';
}

export type ParsedEventPayload =
  | {
      kind: 'subscription';
      action: 'created' | 'updated' | 'active' | 'canceled' | 'revoked';
      subscription: NormalizedSubscription;
      customer?: NormalizedCustomer;
    }
  | {
      kind: 'order';
      action: 'created' | 'paid' | 'refunded';
      order: NormalizedOrder;
    }
  | { kind: 'unknown'; rawType: string };

export interface ParsedEvent {
  eventId: string;
  type: string;
  timestamp: string;
  payload: ParsedEventPayload;
}

export type WebhookHeaders = Record<string, string | string[] | undefined>;

export class WebhookVerifyError extends Error {
  public readonly status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = 'WebhookVerifyError';
    this.status = status;
  }
}

export interface IPaymentProvider {
  readonly name: PaymentProviderName;
  isConfigured(): boolean;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  openPortal(input: OpenPortalInput): Promise<OpenPortalResult>;
  changePlan(input: ChangePlanInput): Promise<NormalizedSubscription>;
  verifyWebhook(rawBody: Buffer, headers: WebhookHeaders): void;
  parseEvent(rawBody: Buffer, headers: WebhookHeaders): ParsedEvent;
  listActiveSubscriptions(): Promise<NormalizedSubscription[]>;
  /**
   * Fetch a single subscription by its provider id, regardless of status.
   * Resolves `null` when the provider no longer knows the id (404) — used by
   * the reconcile drift-healer to revisit local rows that dropped out of the
   * `?active=true` listing (prompt 13 / F4).
   */
  getSubscription(
    providerSubscriptionId: string,
  ): Promise<NormalizedSubscription | null>;
}
