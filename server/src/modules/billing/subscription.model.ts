import mongoose, { type InferSchemaType, type HydratedDocument } from 'mongoose';
import { PAYMENT_PROVIDERS } from './customer.model.js';

export const PLAN_SLUGS = ['free', 'pro', 'business'] as const;
export type PlanSlug = (typeof PLAN_SLUGS)[number];

export const SUBSCRIPTION_STATUSES = [
  'active',
  'past_due',
  'canceled',
  'revoked',
] as const;
export type SubscriptionStatusName = (typeof SUBSCRIPTION_STATUSES)[number];

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
