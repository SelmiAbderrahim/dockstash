import mongoose, { type InferSchemaType, type HydratedDocument } from 'mongoose';

/** Only paid plans are grantable. `free` is rejected at the zod schema. */
export const GRANTABLE_PLAN_SLUGS = ['pro', 'business'] as const;
export type GrantablePlanSlug = (typeof GRANTABLE_PLAN_SLUGS)[number];

/** Grant window. Month/year is pricing-only in Dockstash, so the duration is
 *  independent of the plan slug. */
export const GRANT_DURATIONS = ['one_month', 'one_year'] as const;
export type GrantDuration = (typeof GRANT_DURATIONS)[number];

/**
 * Every comped grant writes ONE `Subscription` row whose
 * `providerSubscriptionId` is `invite-grant-<invitationId>`. This prefix is the
 * sole discriminator between a comped grant and a real Polar row — the
 * resolver, the daily sweep, the webhook supersede, and the reconcile exclusion
 * all scope on it. Polar rows keep status-only semantics (a `past_due` renewal
 * grace must survive), so NOTHING here may widen to non-prefixed rows.
 */
export const INVITE_GRANT_PREFIX = 'invite-grant-';

/** Mongo filter form of {@link INVITE_GRANT_PREFIX}. Constant, never user-fed. */
export const INVITE_GRANT_RE = /^invite-grant-/;

/** `productId` stamped on grant rows — never a real Polar product. */
export const INVITE_GRANT_PRODUCT_ID = 'invite-grant';

/**
 * Single-use invitation link that comps a paid plan for a fixed window.
 *
 * Status is DERIVED, never stored (`deriveInvitationStatus`):
 *   `revokedAt` → revoked; else `claimedAt` → claimed;
 *   else `expiresAt <= now` → expired; else pending.
 * Claimed outranks expired: a claim that landed before the link expired stays
 * "claimed" forever.
 *
 * `expiresAt` bounds the LINK, not the grant. The grant window starts at claim
 * time and is stored as `currentPeriodEnd` on the grant subscription row.
 */
const invitationSchema = new mongoose.Schema(
  {
    // plaintext-safe: single-use capability link; superadmin copy-URL-from-list
    // requires the raw value; revocable, grants nothing but a comped plan.
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    planSlug: {
      type: String,
      enum: GRANTABLE_PLAN_SLUGS,
      required: true,
    },
    grantDuration: {
      type: String,
      enum: GRANT_DURATIONS,
      required: true,
    },
    /** Optional admin note (attribution handle). NEVER served publicly. */
    label: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    /** Audit only; survives user deletion (no cascade). */
    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

invitationSchema.index({ createdAt: -1 });

export type InvitationDocument = InferSchemaType<typeof invitationSchema>;
export type InvitationHydrated = HydratedDocument<InvitationDocument>;

export const Invitation = mongoose.model('Invitation', invitationSchema);

export type InvitationStatus = 'pending' | 'claimed' | 'expired' | 'revoked';

/** Derived-status contract (see the schema doc comment). Pure. */
export function deriveInvitationStatus(
  row: { revokedAt?: Date | null; claimedAt?: Date | null; expiresAt: Date },
  now: Date,
): InvitationStatus {
  if (row.revokedAt) return 'revoked';
  if (row.claimedAt) return 'claimed';
  if (row.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'pending';
}

/**
 * True when `sub` is a comped grant row whose window has elapsed. Exact-time
 * enforcement at read time so a lapsed grant stops entitling the instant it
 * lapses, without waiting for the nightly sweep. Polar rows always return
 * false — they may legitimately carry a past `currentPeriodEnd` while `active`
 * until the renewal webhook lands.
 */
export function isInviteGrantExpired(
  sub: { providerSubscriptionId: string; currentPeriodEnd?: Date | null },
  now: number,
): boolean {
  if (!sub.providerSubscriptionId.startsWith(INVITE_GRANT_PREFIX)) return false;
  return Boolean(sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() <= now);
}
