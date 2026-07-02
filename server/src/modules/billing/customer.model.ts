import mongoose, { type InferSchemaType, type HydratedDocument } from 'mongoose';

export const PAYMENT_PROVIDERS = ['polar', 'stripe'] as const;
export type PaymentProviderName = (typeof PAYMENT_PROVIDERS)[number];

const customerSchema = new mongoose.Schema(
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
    providerCustomerId: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
  },
  { timestamps: true },
);

customerSchema.index({ provider: 1, providerCustomerId: 1 }, { unique: true });

export type CustomerDocument = InferSchemaType<typeof customerSchema>;
export type CustomerHydrated = HydratedDocument<CustomerDocument>;

export const Customer = mongoose.model('Customer', customerSchema);
