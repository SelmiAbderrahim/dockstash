import mongoose, { type InferSchemaType, type HydratedDocument } from 'mongoose';
import { PAYMENT_PROVIDERS, type PaymentProviderName } from './customer.model.js';

export const PLAN_SLUGS = ['free', 'pro', 'business'] as const;
export type PlanSlug = (typeof PLAN_SLUGS)[number];

export const SUBSCRIPTION_STATUSES = [
  'active',
  'past_due',
  'incomplete',
  'canceled',
  'revoked',
] as const;
export type SubscriptionStatusName = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * Row-selection priority when a user has multiple subscription rows (e.g.
 * re-subscribe after a cancel). Lower wins; ties broken by newest `createdAt`.
 * Prevents a newer canceled row from shadowing an older active one.
 */
export const STATUS_PRIORITY: Record<SubscriptionStatusName, number> = {
  active: 0,
  past_due: 1,
  incomplete: 2,
  canceled: 3,
  revoked: 4,
};

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    provider: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      required: true,
    },
    providerSubscriptionId: {
      type: String,
      required: true,
      trim: true,
    },
    productId: {
      type: String,
      required: true,
      trim: true,
    },
    planSlug: {
      type: String,
      enum: PLAN_SLUGS,
      required: true,
      default: 'free',
    },
    status: {
      type: String,
      enum: SUBSCRIPTION_STATUSES,
      required: true,
      default: 'active',
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      required: true,
      default: false,
    },
    currentPeriodEnd: {
      type: Date,
      default: null,
    },
    // Lifecycle fields (prompt 07). `graceEndsAt` starts on transition into
    // `past_due` and is checked by `resolveEntitlements`. `selectionRequired`
    // is set when a downgrade would exceed the target tier's project cap; the
    // user chooses which project stays active via `selectProjectToKeep`.
    graceEndsAt: {
      type: Date,
      default: null,
    },
    selectionRequired: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { timestamps: true },
);

subscriptionSchema.index({ provider: 1, providerSubscriptionId: 1 }, { unique: true });

export type SubscriptionDocument = InferSchemaType<typeof subscriptionSchema>;
export type SubscriptionHydrated = HydratedDocument<SubscriptionDocument>;

export const Subscription = mongoose.model('Subscription', subscriptionSchema);

/**
 * Return the user's effective subscription row: best status first
 * (`STATUS_PRIORITY`), newest `createdAt` on ties. Users accumulate rows when
 * they cancel and re-subscribe; naive latest-by-createdAt lets a newer
 * canceled row shadow an older active one.
 */
export async function findEffectiveSubscription(
  userId: string | mongoose.Types.ObjectId,
  provider: PaymentProviderName,
): Promise<SubscriptionHydrated | null> {
  const subs = await Subscription.find({ userId, provider });
  if (subs.length === 0) return null;
  subs.sort((a, b) => {
    const byPriority = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (byPriority !== 0) return byPriority;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  /* c8 ignore next -- length is checked above, so [0] is always defined */
  return subs[0] ?? null;
}
