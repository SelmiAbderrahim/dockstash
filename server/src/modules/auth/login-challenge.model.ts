import mongoose, { type InferSchemaType, type HydratedDocument } from 'mongoose';

export const OTP_CODE_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

/**
 * One email-OTP login challenge for a Superadmin signing in from an unknown
 * device/IP. The plaintext code is NEVER stored: `codeHash` is
 * sha256(`${secret}:${code}`) with a per-challenge random `secret`.
 *
 * Why sha256 + salt instead of bcrypt: the code space is only 10^6, so any
 * hash is offline-brute-forceable by an attacker with DB read access. The
 * real controls are the 10-minute TTL, the 5-attempt online cap, and
 * single-use consumption; the per-challenge secret merely blocks
 * precomputation across challenges without adding bcrypt latency to logins.
 */
const loginChallengeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // plaintext-safe: sha256(secret||code) — one-way hash of the OTP, not
    // the raw code. Even an attacker with DB read access must brute-force
    // the 10^6 code space against the online 5-attempt cap.
    codeHash: { type: String, required: true },
    // plaintext-safe: random 16-byte salt used only inside `codeHash`. Never
    // used to authenticate; leaking it does not enable an offline compromise
    // beyond what `codeHash` already permits.
    secret: { type: String, required: true },
    attempts: { type: Number, required: true, default: 0 },
    ip: { type: String, default: '' },
    uaHash: { type: String, default: '' },
    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Mongo reaps expired challenges lazily (~60s cadence); queries must still
// filter on `expiresAt` themselves.
loginChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type LoginChallengeDocument = InferSchemaType<typeof loginChallengeSchema>;
export type LoginChallengeHydrated = HydratedDocument<LoginChallengeDocument>;

export const LoginChallenge =
  (mongoose.models.LoginChallenge as mongoose.Model<LoginChallengeDocument>) ||
  mongoose.model('LoginChallenge', loginChallengeSchema);
