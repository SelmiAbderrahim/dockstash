import mongoose, { type InferSchemaType, type HydratedDocument } from 'mongoose';
import { PAYMENT_PROVIDERS } from './customer.model.js';

export const ORDER_STATUSES = ['paid', 'refunded'] as const;
export type OrderStatusName = (typeof ORDER_STATUSES)[number];

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      required: true,
    },
    providerOrderId: {
      type: String,
      required: true,
      trim: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      default: null,
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      required: true,
      default: 'usd',
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      required: true,
      default: 'paid',
    },
  },
  { timestamps: true },
);

orderSchema.index({ provider: 1, providerOrderId: 1 }, { unique: true });

export type OrderDocument = InferSchemaType<typeof orderSchema>;
export type OrderHydrated = HydratedDocument<OrderDocument>;

export const Order = mongoose.model('Order', orderSchema);
