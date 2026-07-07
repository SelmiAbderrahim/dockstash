import mongoose, { type InferSchemaType, type HydratedDocument } from 'mongoose';
import { PLAN_SLUGS } from './subscription.model.js';

export const BILLING_INTERVALS = ['month', 'year'] as const;
export type PricingInterval = (typeof BILLING_INTERVALS)[number];

const pricingTierSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      enum: PLAN_SLUGS,
      required: true,
      unique: true,
    },
    name: { type: String, required: true, trim: true },
    priceMonthly: { type: Number, required: true, min: 0 },
    priceYearly: { type: Number, required: true, min: 0 },
    productIdMonthly: { type: String, default: null },
    productIdYearly: { type: String, default: null },
    interval: {
      type: String,
      enum: BILLING_INTERVALS,
      required: true,
      default: 'month',
    },
    caps: {
      projects: { type: Number, required: true },
      /** Max registered fleet agents; Infinity stored as MAX_SAFE_INTEGER. */
      agents: { type: Number, required: true },
      retentionDays: { type: Number, required: true },
      frequency: {
        type: String,
        enum: ['daily', 'hourly', 'any-cron'],
        required: true,
      },
    },
    flags: {
      schedules: { type: Boolean, required: true, default: false },
      emailAlerts: { type: Boolean, required: true, default: false },
    },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export type PricingTierDocument = InferSchemaType<typeof pricingTierSchema>;
export type PricingTierHydrated = HydratedDocument<PricingTierDocument>;

export const PricingTier =
  (mongoose.models.PricingTier as mongoose.Model<PricingTierDocument>) ||
  mongoose.model('PricingTier', pricingTierSchema);
