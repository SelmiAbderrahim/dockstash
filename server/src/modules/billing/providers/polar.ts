import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../../config/env.js';
import type {
  ChangePlanInput,
  CreateCheckoutInput,
  CreateCheckoutResult,
  IPaymentProvider,
  NormalizedCustomer,
  NormalizedOrder,
  NormalizedSubscription,
  NormalizedSubscriptionStatus,
  OpenPortalInput,
  OpenPortalResult,
  ParsedEvent,
  ParsedEventPayload,
  WebhookHeaders,
} from '../payment-provider.js';
import { WebhookVerifyError } from '../payment-provider.js';
import {
  getPolarRestClient,
  listAllPolarPages,
  type PolarPaginatedResponse,
  type PolarRestClient,
} from './polar-rest.js';

export const REPLAY_TOLERANCE_SECONDS = 5 * 60;

// ---------------------------------------------------------------------------
// Raw Polar shapes — only the fields we read.
// ---------------------------------------------------------------------------

interface RawPolarCustomer {
  id: string;
  email: string;
  external_id?: string | null;
}

interface RawPolarSubscription {
  id: string;
  status: string;
  customer_id: string;
  customer?: { external_id?: string | null; email?: string | null } | null;
  external_customer_id?: string | null;
  product_id: string;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
}

interface RawPolarOrder {
  id: string;
  status?: string | null;
  subscription_id?: string | null;
  customer_id: string;
  customer?: { external_id?: string | null } | null;
  external_customer_id?: string | null;
  total_amount?: number | null;
  amount?: number | null;
  currency?: string | null;
}

interface RawPolarCheckout {
  id: string;
  url: string;
}

interface RawPolarCustomerSession {
  customer_portal_url: string;
}

// ---------------------------------------------------------------------------
// Mapping helpers.
// ---------------------------------------------------------------------------

const POLAR_STATUS_MAP: Record<string, NormalizedSubscriptionStatus> = {
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  canceled: 'canceled',
  revoked: 'revoked',
  incomplete: 'incomplete',
  incomplete_expired: 'canceled',
  unpaid: 'past_due',
};

function mapStatus(raw: string | undefined | null): NormalizedSubscriptionStatus {
  if (!raw) return 'incomplete';
  return POLAR_STATUS_MAP[raw] ?? 'incomplete';
}

function toNormalizedSubscription(raw: RawPolarSubscription): NormalizedSubscription {
  return {
    providerSubscriptionId: raw.id,
    providerCustomerId: raw.customer_id,
    externalCustomerId: raw.external_customer_id ?? raw.customer?.external_id ?? undefined,
    productId: raw.product_id,
    status: mapStatus(raw.status),
    cancelAtPeriodEnd: Boolean(raw.cancel_at_period_end),
    currentPeriodEnd: raw.current_period_end ? new Date(raw.current_period_end) : null,
  };
}

function toNormalizedCustomerFromSub(
  raw: RawPolarSubscription,
): NormalizedCustomer | undefined {
  const email = raw.customer?.email;
  if (!email) return undefined;
  return {
    providerCustomerId: raw.customer_id,
    email,
    externalId: raw.external_customer_id ?? raw.customer?.external_id ?? undefined,
  };
}

function toNormalizedOrder(raw: RawPolarOrder): NormalizedOrder {
  const amount = raw.total_amount ?? raw.amount ?? 0;
  const status = raw.status === 'refunded' ? 'refunded' : 'paid';
  return {
    providerOrderId: raw.id,
    providerCustomerId: raw.customer_id,
    providerSubscriptionId: raw.subscription_id ?? undefined,
    externalCustomerId: raw.external_customer_id ?? raw.customer?.external_id ?? undefined,
    amount,
    currency: (raw.currency ?? 'usd').toLowerCase(),
    status,
  };
}

// ---------------------------------------------------------------------------
// Standard Webhooks HMAC helpers.
// ---------------------------------------------------------------------------

// Polar follows Standard Webhooks but treats the configured secret as a RAW
// string: its SDK base64-encodes the secret before handing it to the
// standardwebhooks lib, which base64-decodes it straight back — so the HMAC key
// is the raw secret's UTF-8 bytes verbatim (a `whsec_` prefix is part of the
// key, never stripped: `_` isn't valid base64). This mirrors `validateEvent` in
// `@polar-sh/sdk`. Do NOT base64-decode here, or every signature 401s.
function decodeStandardWebhookSecret(secret: string): Buffer {
  return Buffer.from(secret, 'utf8');
}

function decodeBase64Strict(value: string): Buffer | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value) return null;
  return decoded;
}

function pickHeader(headers: WebhookHeaders, name: string): string | null {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== lower) continue;
    if (Array.isArray(value)) {
      const first = value[0];
      if (typeof first === 'string' && first.length > 0) return first;
    } else if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Provider.
// ---------------------------------------------------------------------------

export interface PolarProviderOptions {
  getClient?: () => PolarRestClient;
  nowSeconds?: () => number;
  getWebhookSecret?: () => string | null;
}

export class PolarProvider implements IPaymentProvider {
  public readonly name = 'polar' as const;
  private readonly options: Required<PolarProviderOptions>;

  constructor(options: PolarProviderOptions = {}) {
    this.options = {
      getClient: options.getClient ?? getPolarRestClient,
      nowSeconds: options.nowSeconds ?? (() => Math.floor(Date.now() / 1000)),
      getWebhookSecret:
        options.getWebhookSecret ?? (() => env.POLAR_WEBHOOK_SECRET ?? null),
    };
  }

  isConfigured(): boolean {
    // Both the opt-in flag AND the credential are required: a token left in
    // the environment with PAYMENT_PROVIDER=none must not activate billing.
    return env.PAYMENT_PROVIDER === 'polar' && Boolean(env.POLAR_ACCESS_TOKEN);
  }

  private client(): PolarRestClient {
    return this.options.getClient();
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const raw = await this.client().request<RawPolarCheckout>('/checkouts/', {
      method: 'POST',
      body: {
        products: [input.productId],
        customer_email: input.email,
        external_customer_id: input.userId,
        success_url: input.successUrl,
        return_url: input.cancelUrl,
        metadata: { ...(input.metadata ?? {}), userId: input.userId },
      },
      idempotencyKey: `checkout-${input.userId}-${input.productId}`,
    });
    return { url: raw.url, providerCheckoutId: raw.id };
  }

  async openPortal(input: OpenPortalInput): Promise<OpenPortalResult> {
    const raw = await this.client().request<RawPolarCustomerSession>(
      '/customer-sessions/',
      {
        method: 'POST',
        body: { customer_id: input.providerCustomerId },
      },
    );
    return { url: raw.customer_portal_url };
  }

  async changePlan(input: ChangePlanInput): Promise<NormalizedSubscription> {
    const raw = await this.client().request<RawPolarSubscription>(
      `/subscriptions/${input.providerSubscriptionId}`,
      {
        method: 'PATCH',
        body: { product_id: input.productId },
      },
    );
    return toNormalizedSubscription(raw);
  }

  verifyWebhook(rawBody: Buffer, headers: WebhookHeaders): void {
    const secret = this.options.getWebhookSecret();
    if (!secret) {
      throw new WebhookVerifyError('POLAR_WEBHOOK_SECRET is not configured', 500);
    }
    const id = pickHeader(headers, 'webhook-id');
    const ts = pickHeader(headers, 'webhook-timestamp');
    const sigHeader = pickHeader(headers, 'webhook-signature');
    if (!id || !ts || !sigHeader) {
      throw new WebhookVerifyError('missing standard-webhooks headers', 401);
    }
    const tsSeconds = Number(ts);
    if (!Number.isFinite(tsSeconds)) {
      throw new WebhookVerifyError('webhook-timestamp is not a number', 401);
    }
    const now = this.options.nowSeconds();
    if (Math.abs(now - tsSeconds) > REPLAY_TOLERANCE_SECONDS) {
      throw new WebhookVerifyError('webhook-timestamp outside replay window', 401);
    }
    const signedContent = `${id}.${ts}.${rawBody.toString('utf8')}`;
    const expected = createHmac('sha256', decodeStandardWebhookSecret(secret))
      .update(signedContent, 'utf8')
      .digest();

    for (const part of sigHeader.split(' ')) {
      const [scheme, value] = part.split(',');
      if (scheme !== 'v1' || !value) continue;
      const candidate = decodeBase64Strict(value);
      if (!candidate) continue;
      if (candidate.length !== expected.length) continue;
      if (timingSafeEqual(candidate, expected)) return;
    }
    throw new WebhookVerifyError('signature mismatch', 401);
  }

  parseEvent(rawBody: Buffer, headers: WebhookHeaders): ParsedEvent {
    const id = pickHeader(headers, 'webhook-id');
    const ts = pickHeader(headers, 'webhook-timestamp');
    if (!id || !ts) {
      throw new WebhookVerifyError('missing standard-webhooks headers', 401);
    }

    let envelope: unknown;
    try {
      envelope = JSON.parse(rawBody.toString('utf8'));
    } catch (err) {
      throw new WebhookVerifyError(
        `invalid JSON: ${(err as Error).message}`,
        400,
      );
    }
    if (!envelope || typeof envelope !== 'object') {
      throw new WebhookVerifyError('envelope is not an object', 400);
    }
    const record = envelope as Record<string, unknown>;
    const rawType = typeof record.type === 'string' ? record.type : '';
    if (!rawType) {
      throw new WebhookVerifyError('envelope is missing `type`', 400);
    }
    const data =
      record.data && typeof record.data === 'object'
        ? (record.data as Record<string, unknown>)
        : {};

    const payload = this.buildPayload(rawType, data);
    return { eventId: id, type: rawType, timestamp: ts, payload };
  }

  private buildPayload(
    rawType: string,
    data: Record<string, unknown>,
  ): ParsedEventPayload {
    if (rawType.startsWith('subscription.')) {
      const action = rawType.slice('subscription.'.length);
      if (
        action === 'created' ||
        action === 'updated' ||
        action === 'active' ||
        action === 'canceled' ||
        action === 'revoked'
      ) {
        const sub = toNormalizedSubscription(data as unknown as RawPolarSubscription);
        return {
          kind: 'subscription',
          action,
          subscription: sub,
          customer: toNormalizedCustomerFromSub(data as unknown as RawPolarSubscription),
        };
      }
    }
    if (rawType.startsWith('order.')) {
      const action = rawType.slice('order.'.length);
      if (action === 'created' || action === 'paid' || action === 'refunded') {
        return {
          kind: 'order',
          action,
          order: toNormalizedOrder(data as unknown as RawPolarOrder),
        };
      }
    }
    return { kind: 'unknown', rawType };
  }

  async listActiveSubscriptions(): Promise<NormalizedSubscription[]> {
    const items = await listAllPolarPages<RawPolarSubscription>((page) =>
      this.client().request<PolarPaginatedResponse<RawPolarSubscription>>(
        '/subscriptions/',
        { query: { active: true, page, limit: 100 } },
      ),
    );
    return items.map(toNormalizedSubscription);
  }
}

export function __getRawCustomerMapper(raw: RawPolarCustomer): NormalizedCustomer {
  return {
    providerCustomerId: raw.id,
    email: raw.email,
    externalId: raw.external_id ?? undefined,
  };
}
