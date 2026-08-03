import mongoose, { type InferSchemaType, type HydratedDocument } from 'mongoose';
import { SUPPORTED_LOCALES } from '../../shared/i18n/locales.js';

export const ROLE_MEMBER = 'Member';
export const ROLE_CLIENT = 'Client';
export const ROLE_OWNER = 'Owner';
export const ROLE_ADMIN = 'Admin';

export const ROLES = [ROLE_MEMBER, ROLE_CLIENT, ROLE_OWNER, ROLE_ADMIN] as const;
export type Role = (typeof ROLES)[number];

const ROLE_RANK: Record<Role, number> = {
  [ROLE_MEMBER]: 1,
  [ROLE_CLIENT]: 2,
  [ROLE_OWNER]: 3,
  [ROLE_ADMIN]: 4,
};

export function getRoleRank(role: string | undefined): number {
  if (!role) return 0;
  return ROLE_RANK[role as Role] ?? 0;
}

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    // OAuth provider subject ids. Sparse-unique: absent on password-only
    // accounts, at most one account per provider identity. OAuth-only users
    // still get a random bcrypt password (see findOrCreateOAuthUser) so the
    // required password invariant holds.
    googleId: {
      type: String,
      index: { unique: true, sparse: true },
    },
    githubId: {
      type: String,
      index: { unique: true, sparse: true },
    },
    profile: {
      firstName: { type: String, default: '' },
      lastName: { type: String, default: '' },
    },
    role: {
      type: String,
      enum: ROLES,
      default: ROLE_MEMBER,
    },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    // Email verification lifecycle. New accounts start unverified; the token +
    // expiry mirror the password-reset pattern above. Product routes are gated
    // behind `emailVerified` via the requireVerified middleware.
    emailVerified: { type: Boolean, required: true, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },
    // Per-user preferred locale — used by the communication module to render
    // transactional + alert emails in the recipient's language (prompt 08).
    // Falls back to DEFAULT_LOCALE when unset.
    language: {
      type: String,
      enum: SUPPORTED_LOCALES,
      default: null,
    },
    // In-app guided-tour widget preference. Defaults on; pre-existing
    // documents lack the field and are treated as enabled (`?? true`).
    guideMe: { type: Boolean, required: true, default: true },
    // Deletion lifecycle (prompt 11 GDPR right-to-deletion). A non-null
    // `deletionScheduledAt` marks the account soft-deleted; the repo purge
    // runs after that timestamp. `deletionWarningSentAt` dedupes the final
    // Resend warning email.
    deletionScheduledAt: { type: Date, default: null },
    deletionWarningSentAt: { type: Date, default: null },
    // Legal hold overrides the deletion purge — held accounts are retained
    // until the hold is explicitly released.
    legalHold: { type: Boolean, required: true, default: false },
    // Opt-in recovery-code escrow. When enabled, `wrappedKey` holds the master
    // key wrapped under a Shamir escrow key; the recovery codes (the shares)
    // are shown to the user once and NEVER stored. Absent = zero-knowledge
    // default (lose the master key = unrecoverable). See recovery-codes.ts.
    recoveryEscrow: {
      enabled: { type: Boolean, default: false },
      wrappedKey: {
        ciphertext: { type: String, default: '' },
        iv: { type: String, default: '' },
        authTag: { type: String, default: '' },
        keyVersion: { type: Number, default: 0 },
        threshold: { type: Number, default: 0 },
        shareCount: { type: Number, default: 0 },
      },
      createdAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof userSchema>;
export type UserHydrated = HydratedDocument<UserDocument>;

export const User = mongoose.model('User', userSchema);
