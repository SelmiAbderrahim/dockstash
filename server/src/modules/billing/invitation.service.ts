import { randomBytes } from 'node:crypto';
import { logger } from '../../config/logger.js';
import { HttpError } from '../../shared/utils/http-error.js';
import { User } from '../users/index.js';
import { getPaymentProvider } from './active-provider.js';
import {
  Subscription,
  findEffectiveSubscription,
  type SubscriptionHydrated,
} from './subscription.model.js';
import { applyProjectCap } from './lifecycle.service.js';
import {
  Invitation,
  INVITE_GRANT_PREFIX,
  INVITE_GRANT_PRODUCT_ID,
  INVITE_GRANT_RE,
  deriveInvitationStatus,
  isInviteGrantExpired,
  type GrantDuration,
  type GrantablePlanSlug,
  type InvitationHydrated,
  type InvitationStatus,
} from './invitation.model.js';
import type { CreateInvitationInput, ListInvitationsQuery } from './invitation.schema.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Server-generated capability token. Never client-supplied. */
function mintToken(): string {
  return randomBytes(24).toString('base64url');
}

/** Grant end = claim instant + one calendar month / year (UTC). JS month
 *  overflow is the spec: a Jan-31 claim lands in early March. */
export function grantEndFor(claimedAt: Date, duration: GrantDuration): Date {
  const end = new Date(claimedAt);
  if (duration === 'one_month') end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCFullYear(end.getUTCFullYear() + 1);
  return end;
}

/** Whether an effective subscription row currently entitles a PAID plan. A
 *  lapsed comped grant does not — its holder may claim a fresh invitation. */
function entitlesPaidPlan(sub: SubscriptionHydrated, now: number): boolean {
  if (sub.planSlug === 'free') return false;
  if (sub.status === 'active') return !isInviteGrantExpired(sub, now);
  if (sub.status === 'past_due') return (sub.graceEndsAt?.getTime() ?? 0) > now;
  return false;
}

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

export interface PublicInvitation {
  plan: GrantablePlanSlug;
  grantDuration: GrantDuration;
  expiresAt: string;
  status: InvitationStatus;
}

/**
 * The ONLY shape the unauthenticated resolve endpoint may emit. `label`,
 * `claimedBy`, `createdBy`, and `_id` never cross this boundary.
 */
export function toPublicInvitation(row: InvitationHydrated, now: Date): PublicInvitation {
  return {
    plan: row.planSlug,
    grantDuration: row.grantDuration,
    expiresAt: row.expiresAt.toISOString(),
    status: deriveInvitationStatus(row, now),
  };
}

export interface AdminInvitation extends PublicInvitation {
  id: string;
  /** Superadmin-only: the raw token, so the console can build the claim URL. */
  token: string;
  label: string;
  claimedAt: string | null;
  claimedByEmail: string | null;
  createdAt: string;
}

function toAdminInvitation(
  row: InvitationHydrated,
  now: Date,
  emailById: Map<string, string>,
): AdminInvitation {
  return {
    ...toPublicInvitation(row, now),
    id: row._id.toString(),
    token: row.token,
    label: row.label,
    claimedAt: row.claimedAt?.toISOString() ?? null,
    claimedByEmail: row.claimedBy ? (emailById.get(row.claimedBy.toString()) ?? null) : null,
    createdAt: row.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Superadmin management
// ---------------------------------------------------------------------------

export async function createInvitation(
  createdBy: string,
  input: CreateInvitationInput,
  now: Date = new Date(),
): Promise<AdminInvitation> {
  const row = (await Invitation.create({
    token: mintToken(),
    planSlug: input.planSlug,
    grantDuration: input.grantDuration,
    label: input.label ?? '',
    expiresAt: new Date(now.getTime() + input.expiresInDays * DAY_MS),
    createdBy,
  })) as InvitationHydrated;
  return toAdminInvitation(row, now, new Map());
}

export interface ListInvitationsResult {
  invitations: AdminInvitation[];
  total: number;
  page: number;
  pages: number;
}

export async function listInvitations(
  input: ListInvitationsQuery,
  now: Date = new Date(),
): Promise<ListInvitationsResult> {
  const [rows, total] = await Promise.all([
    Invitation.find()
      .sort({ createdAt: -1 })
      .skip((input.page - 1) * input.limit)
      .limit(input.limit),
    Invitation.countDocuments(),
  ]);
  const claimantIds = rows.flatMap((row) => (row.claimedBy ? [row.claimedBy] : []));
  const users = await User.find({ _id: { $in: claimantIds } })
    .select('email')
    .lean();
  const emailById = new Map(users.map((user) => [String(user._id), user.email]));
  return {
    invitations: rows.map((row) => toAdminInvitation(row, now, emailById)),
    total,
    page: input.page,
    pages: Math.ceil(total / input.limit),
  };
}

/**
 * Soft-revoke: stamps `revokedAt` (never deletes — the row is the audit
 * trail). A claimed link is rejected; revoking must never touch an
 * already-activated grant. Re-revoking is a no-op.
 */
export async function revokeInvitation(
  id: string,
  now: Date = new Date(),
): Promise<AdminInvitation> {
  const row = await Invitation.findById(id);
  if (!row) throw HttpError.notFound('invitations.error.notFound');
  if (row.claimedAt) throw HttpError.conflict('invitations.error.alreadyClaimed');
  if (!row.revokedAt) {
    row.revokedAt = now;
    await row.save();
  }
  return toAdminInvitation(row, now, new Map());
}

// ---------------------------------------------------------------------------
// Public resolve + claim
// ---------------------------------------------------------------------------

export async function getPublicInvitation(
  token: string,
  now: Date = new Date(),
): Promise<PublicInvitation> {
  const row = await Invitation.findOne({ token });
  if (!row) throw HttpError.notFound('invitations.error.notFound');
  return toPublicInvitation(row, now);
}

export interface ClaimResult {
  planSlug: GrantablePlanSlug;
  grantDuration: GrantDuration;
  claimedAt: Date;
  currentPeriodEnd: Date;
  label: string;
  claimantEmail: string;
  claimantName: string;
}

/**
 * Claim a link: one atomic winner, then one comped `Subscription` row.
 *
 * Order: already-subscribed guard → atomic single-use claim → grant row. When
 * the grant insert throws, the claim is compensated (the link returns to
 * `pending`) so the invitation is not silently burned.
 */
export async function claimInvitation(
  userId: string,
  token: string,
  now: Date = new Date(),
): Promise<ClaimResult> {
  const existing = await findEffectiveSubscription(userId, getPaymentProvider().name);
  if (existing && entitlesPaidPlan(existing, now.getTime())) {
    throw HttpError.conflict('invitations.error.alreadySubscribed');
  }

  // Single atomic winner. Two racing claimers: exactly one match, one grant.
  const row = await Invitation.findOneAndUpdate(
    { token, claimedAt: null, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { claimedAt: now, claimedBy: userId } },
    { new: true },
  );
  if (!row) throw await claimFailureFor(token, now);

  const currentPeriodEnd = grantEndFor(now, row.grantDuration);
  try {
    await Subscription.create({
      userId,
      provider: getPaymentProvider().name,
      providerSubscriptionId: `${INVITE_GRANT_PREFIX}${row._id.toString()}`,
      productId: INVITE_GRANT_PRODUCT_ID,
      planSlug: row.planSlug,
      status: 'active',
      currentPeriodEnd,
    });
  } catch (err) {
    await Invitation.updateOne(
      { _id: row._id },
      { $set: { claimedAt: null, claimedBy: null } },
    );
    throw err;
  }

  const user = await User.findById(userId).select('email profile').lean();
  const profile = user?.profile;
  return {
    planSlug: row.planSlug,
    grantDuration: row.grantDuration,
    claimedAt: now,
    currentPeriodEnd,
    label: row.label,
    claimantEmail: user?.email ?? '',
    claimantName: `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim(),
  };
}

/** Re-read a link that failed the atomic claim and name the precise reason.
 *  `pending` is unreachable: the atomic filter would have matched it. */
async function claimFailureFor(token: string, now: Date): Promise<HttpError> {
  const row = await Invitation.findOne({ token });
  if (!row) return HttpError.notFound('invitations.error.notFound');
  const status = deriveInvitationStatus(row, now);
  if (status === 'revoked') return HttpError.conflict('invitations.error.revoked');
  if (status === 'claimed') return HttpError.conflict('invitations.error.alreadyClaimed');
  return HttpError.conflict('invitations.error.expired');
}

// ---------------------------------------------------------------------------
// Grant lifecycle
// ---------------------------------------------------------------------------

/**
 * A real purchase supersedes a live comped grant. Called from the webhook
 * `active` branch — no `applyProjectCap` here: the user is landing on a PAID
 * plan, not on free.
 */
export async function cancelLiveInviteGrants(userId: string): Promise<number> {
  const result = await Subscription.updateMany(
    { userId, providerSubscriptionId: INVITE_GRANT_RE, status: 'active' },
    { $set: { status: 'canceled' } },
  );
  return result.modifiedCount;
}

export interface InviteGrantSweepSummary {
  scanned: number;
  expired: number;
  paused: number;
}

/**
 * Cron entry point: demote every elapsed comped grant to Free. Mirrors
 * `expireAllOverdueGraces` — the free landing funnels through
 * `applyProjectCap` (pause, never delete) and one failing row never aborts the
 * sweep. The resolver already refuses to entitle an elapsed grant, so this is
 * the durable state catch-up, not the enforcement point.
 */
export async function sweepExpiredInviteGrants(
  now: Date = new Date(),
): Promise<InviteGrantSweepSummary> {
  const rows = await Subscription.find({
    providerSubscriptionId: INVITE_GRANT_RE,
    status: 'active',
    currentPeriodEnd: { $lte: now },
  }).select('userId planSlug');
  let expired = 0;
  let paused = 0;
  for (const row of rows) {
    const userId = String(row.userId);
    try {
      const priorSlug = row.planSlug;
      await Subscription.updateOne(
        { _id: row._id },
        { $set: { status: 'canceled', planSlug: 'free' } },
      );
      paused += await applyProjectCap(userId, 'free', { priorSlug, now });
      expired += 1;
    } catch (err) {
      logger.error(
        { err, userId },
        'billing.invite-grant-expiry: sweep row failed — continuing',
      );
    }
  }
  return { scanned: rows.length, expired, paused };
}
