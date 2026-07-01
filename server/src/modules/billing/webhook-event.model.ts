import mongoose, { type InferSchemaType, type HydratedDocument } from 'mongoose';
import { PAYMENT_PROVIDERS } from './customer.model.js';

export const WEBHOOK_EVENT_STATUSES = [
  'pending',
  'processed',
  'failed',
  'skipped',
] as const;
export type WebhookEventStatus = (typeof WEBHOOK_EVENT_STATUSES)[number];

const webhookEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      required: true,
    },
    eventId: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: WEBHOOK_EVENT_STATUSES,
      required: true,
      default: 'pending',
    },
    retryCount: {
      type: Number,
      required: true,
      default: 0,
    },
    payloadHash: {
      type: String,
      required: true,
      trim: true,
    },
    error: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

export type WebhookEventDocument = InferSchemaType<typeof webhookEventSchema>;
export type WebhookEventHydrated = HydratedDocument<WebhookEventDocument>;

export const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);
