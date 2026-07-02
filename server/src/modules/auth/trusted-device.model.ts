import mongoose, { type InferSchemaType, type HydratedDocument } from 'mongoose';

export const DEVICE_TRUST_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * A device/IP combination a Superadmin has proven via OTP. `fingerprint` is
 * `${ip}:${sha256(userAgent)}`. Separate collection (not an array on the user
 * document) because the TTL index needs a top-level date field and this keeps
 * unbounded growth off the hot user document.
 */
const trustedDeviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fingerprint: { type: String, required: true },
    ip: { type: String, default: '' },
    uaHash: { type: String, default: '' },
    lastSeenAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

trustedDeviceSchema.index({ userId: 1, fingerprint: 1 }, { unique: true });
// Lazy TTL reaper — queries still filter on `expiresAt` themselves.
trustedDeviceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type TrustedDeviceDocument = InferSchemaType<typeof trustedDeviceSchema>;
export type TrustedDeviceHydrated = HydratedDocument<TrustedDeviceDocument>;

export const TrustedDevice =
  (mongoose.models.TrustedDevice as mongoose.Model<TrustedDeviceDocument>) ||
  mongoose.model('TrustedDevice', trustedDeviceSchema);
