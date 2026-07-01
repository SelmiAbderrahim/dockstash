import { createHash } from 'node:crypto';
import { logger } from '../../../config/logger.js';
import type {
  NormalizedCustomer,
  NormalizedOrder,
  NormalizedSubscription,
  NormalizedSubscriptionStatus,
  ParsedEvent,
} from '../payment-provider.js';
import type { PaymentProviderName } from '../customer.model.js';
import { Customer } from '../customer.model.js';
import { Subscription } from '../subscription.model.js';
import { Order } from '../order.model.js';
import { User } from '../../users/index.js';
import { getPlanForProductId } from '../polar-config.js';
import {
  beginDunning,
  handleDowngrade,
  handleRefund,
  GRACE_WINDOW_MS,
} from '../lifecycle.service.js';

export type DispatchResultStatus = 'processed' | 'skipped' | 'failed';

export interface DispatchResult {
  status: DispatchResultStatus;
  reason?: string;
}

export function payloadHashOf(rawBody: Buffer): string {
  return createHash('sha256').update(rawBody).digest('hex');
}

function toPersistedStatus(status: NormalizedSubscriptionStatus): 'active' | 'past_due' | 'canceled' | 'revoked' {
  switch (status) {
    case 'active':
    case 'trialing':
    case 'incomplete':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'revoked':
      return 'revoked';
    case 'canceled':
    default:
      return 'canceled';
  }
}

async function resolveUserId(
  externalCustomerId: string | undefined,
  fallbackEmail: string | undefined,
): Promise<string | null> {
  if (externalCustomerId) {
    const byId = await User.findById(externalCustomerId).select('_id').lean().catch(() => null);
    if (byId) return String(byId._id);
  }
  if (fallbackEmail) {
    const byEmail = await User.findOne({ email: fallbackEmail.toLowerCase() })
      .select('_id')
      .lean();
    if (byEmail) return String(byEmail._id);
  }
  return null;
}

async function upsertCustomer(
  provider: PaymentProviderName,
  userId: string,
  norm: NormalizedCustomer,
): Promise<string> {
  const existing = await Customer.findOneAndUpdate(
    { provider, providerCustomerId: norm.providerCustomerId },
    {
      $set: {
        provider,
        providerCustomerId: norm.providerCustomerId,
        email: norm.email,
        userId,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  const customerId = String(existing._id);
  await User.updateOne({ _id: userId }, { $set: { customer: existing._id } });
  return customerId;
}

async function upsertSubscription(
  provider: PaymentProviderName,
  userId: string,
  customerId: string,
  norm: NormalizedSubscription,
  overrideStatus?: NormalizedSubscriptionStatus,
): Promise<void> {
  const status = toPersistedStatus(overrideStatus ?? norm.status);
  const planSlug = getPlanForProductId(norm.productId);
  const priorSub = await Subscription.findOne({
    provider,
    providerSubscriptionId: norm.providerSubscriptionId,
  })
    .select('planSlug status graceEndsAt')
    .lean();
  const set: Record<string, unknown> = {
    provider,
    providerSubscriptionId: norm.providerSubscriptionId,
    productId: norm.productId,
    planSlug,
    status,
    cancelAtPeriodEnd: norm.cancelAtPeriodEnd,
    currentPeriodEnd: norm.currentPeriodEnd,
    userId,
    customerId,
  };
  // Lifecycle: transition INTO past_due starts a 14-day grace clock. Repeat
  // deliveries never reset the clock (idempotent).
  if (status === 'past_due') {
    if (!priorSub?.graceEndsAt) {
      set.graceEndsAt = new Date(Date.now() + GRACE_WINDOW_MS);
    }
  } else if (status === 'active') {
    set.graceEndsAt = null;
  }
  const updated = await Subscription.findOneAndUpdate(
    { provider, providerSubscriptionId: norm.providerSubscriptionId },
    { $set: set },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  await User.updateOne({ _id: userId }, { $set: { subscription: updated._id } });

  // Lifecycle: downgrade → pause over-cap projects, never delete.
  if (priorSub && priorSub.planSlug !== planSlug && status === 'active') {
    await handleDowngrade(userId, norm.productId);
  }
  if (status === 'past_due' && !priorSub?.graceEndsAt) {
    await beginDunning(norm.providerSubscriptionId).catch(() => {
      /* already recorded by the upsert above */
    });
  }
}

async function upsertOrder(
  provider: PaymentProviderName,
  userId: string,
  norm: NormalizedOrder,
): Promise<void> {
  let subscriptionId: unknown = null;
  if (norm.providerSubscriptionId) {
    const sub = await Subscription.findOne({
      provider,
      providerSubscriptionId: norm.providerSubscriptionId,
    })
      .select('_id')
      .lean();
    if (sub) subscriptionId = sub._id;
  }
  await Order.findOneAndUpdate(
    { provider, providerOrderId: norm.providerOrderId },
    {
      $set: {
        provider,
        providerOrderId: norm.providerOrderId,
        userId,
        subscriptionId,
        amount: norm.amount,
        currency: norm.currency,
        status: norm.status,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

export async function dispatchEvent(
  provider: PaymentProviderName,
  event: ParsedEvent,
): Promise<DispatchResult> {
  const { payload } = event;

  if (payload.kind === 'unknown') {
    return { status: 'skipped', reason: `unhandled type: ${payload.rawType}` };
  }

  if (payload.kind === 'subscription') {
    const norm = payload.subscription;
    const userId = await resolveUserId(
      norm.externalCustomerId,
      payload.customer?.email,
    );
    if (!userId) {
      logger.warn(
        { provider, providerSubscriptionId: norm.providerSubscriptionId },
        'billing.webhook: could not resolve userId for subscription event',
      );
      return { status: 'skipped', reason: 'user not found' };
    }
    const customerId = await upsertCustomer(
      provider,
      userId,
      payload.customer ?? {
        providerCustomerId: norm.providerCustomerId,
        email: '',
      },
    );
    let overrideStatus: NormalizedSubscriptionStatus | undefined;
    if (payload.action === 'canceled') overrideStatus = 'canceled';
    if (payload.action === 'revoked') overrideStatus = 'revoked';
    if (payload.action === 'active') overrideStatus = 'active';
    await upsertSubscription(provider, userId, customerId, norm, overrideStatus);
    return { status: 'processed' };
  }

  // payload.kind === 'order'
  const norm = payload.order;
  const userId = await resolveUserId(norm.externalCustomerId, undefined);
  if (!userId) {
    // Try via existing Customer link.
    const existing = await Customer.findOne({
      provider,
      providerCustomerId: norm.providerCustomerId,
    })
      .select('userId')
      .lean();
    if (!existing) {
      return { status: 'skipped', reason: 'no customer link' };
    }
    await upsertOrder(provider, String(existing.userId), norm);
    if (norm.status === 'refunded') await handleRefund(norm.providerOrderId);
    return { status: 'processed' };
  }
  await upsertOrder(provider, userId, norm);
  if (norm.status === 'refunded') await handleRefund(norm.providerOrderId);
  return { status: 'processed' };
}
