import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { hashPassword, signToken } from '../auth/index.js';
import { Project } from '../backups/index.js';
import { setResendTransport, type EmailMessage } from '../communication/index.js';
import {
  ROLE_ADMIN,
  ROLE_MEMBER,
  ROLE_SUPERADMIN,
  User,
  toPublicUser,
  type UserHydrated,
} from '../users/index.js';
import { __setPaymentProviderForTests } from './active-provider.js';
import { resolveEntitlements } from './entitlements.service.js';
import { reconcileSubscriptions } from './reconcile.js';
import { Subscription } from './subscription.model.js';
import { dispatchEvent } from './webhook/registry.js';
import type { IPaymentProvider, NormalizedSubscription, ParsedEvent } from './payment-provider.js';
import {
  Invitation,
  INVITE_GRANT_PREFIX,
  deriveInvitationStatus,
  isInviteGrantExpired,
} from './invitation.model.js';
import {
  cancelLiveInviteGrants,
  claimInvitation,
  createInvitation,
  getPublicInvitation,
  grantEndFor,
  listInvitations,
  revokeInvitation,
  sweepExpiredInviteGrants,
} from './invitation.service.js';

const app = createApp();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function createUser(
  email: string,
  role: string = ROLE_MEMBER,
  extra: Record<string, unknown> = {},
): Promise<UserHydrated> {
  return (await User.create({
    email,
    password: await hashPassword('hunter2hunter2'),
    role,
    emailVerified: true,
    profile: { firstName: 'Ada', lastName: 'Lovelace' },
    ...extra,
  })) as UserHydrated;
}

function tokenFor(user: UserHydrated): string {
  return `JWT ${signToken(toPublicUser(user))}`;
}

async function seedProject(ownerId: string, name: string) {
  return Project.create({
    owner: ownerId,
    name,
    path: '/var/www/x',
    plan: { paths: ['/var/www/x'], databases: [], configs: [] },
    repoPasswordEnc: { ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 },
    lastStatus: 'idle',
    paused: false,
  });
}

/** Mint an invitation straight through the service (bypasses the HTTP gate). */
async function seedInvitation(
  createdBy: string,
  over: Partial<{
    planSlug: 'pro' | 'business';
    grantDuration: 'one_month' | 'one_year';
    expiresInDays: number;
    label: string;
  }> = {},
) {
  return createInvitation(createdBy, {
    planSlug: over.planSlug ?? 'business',
    grantDuration: over.grantDuration ?? 'one_year',
    expiresInDays: over.expiresInDays ?? 30,
    label: over.label,
  });
}

beforeAll(async () => {
  await startMemoryMongo();
});
afterAll(async () => {
  await stopMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  env.PAYMENT_PROVIDER = 'polar';
  delete env.CONTACT_RECIPIENT;
  delete env.RESEND_API_KEY;
  delete env.RESEND_FROM;
});
afterEach(() => {
  __setPaymentProviderForTests(null);
  setResendTransport(null);
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('invitation model helpers', () => {
  const base = { expiresAt: new Date('2030-01-01T00:00:00Z') };
  const now = new Date('2025-01-01T00:00:00Z');

  it('derives revoked > claimed > expired > pending', () => {
    expect(deriveInvitationStatus({ ...base, revokedAt: now, claimedAt: now }, now)).toBe('revoked');
    expect(deriveInvitationStatus({ ...base, claimedAt: now }, now)).toBe('claimed');
    expect(deriveInvitationStatus({ expiresAt: new Date(now.getTime() - 1) }, now)).toBe('expired');
    expect(deriveInvitationStatus(base, now)).toBe('pending');
  });

  it('isInviteGrantExpired only ever fires on prefixed rows', () => {
    const past = new Date(now.getTime() - 1);
    const future = new Date(now.getTime() + 1);
    const ms = now.getTime();
    // A Polar row with a stale period end stays entitled.
    expect(isInviteGrantExpired({ providerSubscriptionId: 'sub_x', currentPeriodEnd: past }, ms)).toBe(false);
    expect(isInviteGrantExpired({ providerSubscriptionId: `${INVITE_GRANT_PREFIX}1` }, ms)).toBe(false);
    expect(
      isInviteGrantExpired({ providerSubscriptionId: `${INVITE_GRANT_PREFIX}1`, currentPeriodEnd: future }, ms),
    ).toBe(false);
    expect(
      isInviteGrantExpired({ providerSubscriptionId: `${INVITE_GRANT_PREFIX}1`, currentPeriodEnd: past }, ms),
    ).toBe(true);
  });

  it('grantEndFor advances one calendar month / year in UTC', () => {
    expect(grantEndFor(new Date('2025-03-15T10:00:00Z'), 'one_month').toISOString()).toBe(
      '2025-04-15T10:00:00.000Z',
    );
    expect(grantEndFor(new Date('2025-03-15T10:00:00Z'), 'one_year').toISOString()).toBe(
      '2026-03-15T10:00:00.000Z',
    );
    // Month-end overflow is the spec: Jan 31 + 1 month lands in early March.
    expect(grantEndFor(new Date('2025-01-31T00:00:00Z'), 'one_month').toISOString()).toBe(
      '2025-03-03T00:00:00.000Z',
    );
  });
});

// ---------------------------------------------------------------------------
// Superadmin routes
// ---------------------------------------------------------------------------

describe('superadmin invitation routes', () => {
  let superadmin: UserHydrated;
  let superToken: string;

  beforeEach(async () => {
    superadmin = await createUser('root@example.com', ROLE_SUPERADMIN);
    superToken = tokenFor(superadmin);
  });

  it('creates, lists, and revokes a link', async () => {
    const created = await request(app)
      .post('/api/superadmin/invitations')
      .set('Authorization', superToken)
      .send({ planSlug: 'business', grantDuration: 'one_year', expiresInDays: 7, label: 'x-ada' });
    expect(created.status).toBe(201);
    expect(created.body.invitation.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(created.body.invitation.status).toBe('pending');
    expect(created.body.invitation.label).toBe('x-ada');

    const listed = await request(app)
      .get('/api/superadmin/invitations?page=1&limit=10')
      .set('Authorization', superToken);
    expect(listed.status).toBe(200);
    expect(listed.body).toMatchObject({ total: 1, page: 1, pages: 1 });
    expect(listed.body.invitations[0].claimedByEmail).toBeNull();

    const revoked = await request(app)
      .patch(`/api/superadmin/invitations/${created.body.invitation.id}/revoke`)
      .set('Authorization', superToken);
    expect(revoked.status).toBe(200);
    expect(revoked.body.invitation.status).toBe('revoked');
    // Soft revoke: the row survives as the audit trail.
    expect(await Invitation.countDocuments()).toBe(1);
  });

  it('lists the claimant email and derives every status', async () => {
    const claimant = await createUser('claimant@example.com');
    const pending = await seedInvitation(String(superadmin._id));
    const expired = await seedInvitation(String(superadmin._id), { expiresInDays: 1 });
    const revoked = await seedInvitation(String(superadmin._id));
    const claimed = await seedInvitation(String(superadmin._id));

    await Invitation.updateOne({ _id: expired.id }, { $set: { expiresAt: new Date(Date.now() - 1) } });
    await revokeInvitation(revoked.id);
    await claimInvitation(String(claimant._id), (await Invitation.findById(claimed.id))!.token);

    const page = await listInvitations({ page: 1, limit: 10 });
    const byId = new Map(page.invitations.map((row) => [row.id, row]));
    expect(byId.get(pending.id)?.status).toBe('pending');
    expect(byId.get(expired.id)?.status).toBe('expired');
    expect(byId.get(revoked.id)?.status).toBe('revoked');
    expect(byId.get(claimed.id)?.status).toBe('claimed');
    expect(byId.get(claimed.id)?.claimedByEmail).toBe('claimant@example.com');
  });

  it('lists a claimed row whose claimant was deleted with a null email', async () => {
    const claimant = await createUser('gone@example.com');
    const invite = await seedInvitation(String(superadmin._id));
    await claimInvitation(String(claimant._id), (await Invitation.findById(invite.id))!.token);
    await User.deleteOne({ _id: claimant._id });
    const page = await listInvitations({ page: 1, limit: 10 });
    expect(page.invitations[0]?.claimedByEmail).toBeNull();
  });

  it('rejects non-superadmin callers and anonymous requests', async () => {
    const member = await createUser('member@example.com', ROLE_MEMBER);
    const admin = await createUser('admin@example.com', ROLE_ADMIN);
    for (const token of [tokenFor(member), tokenFor(admin)]) {
      const res = await request(app).get('/api/superadmin/invitations').set('Authorization', token);
      expect(res.status).toBe(403);
    }
    expect((await request(app).get('/api/superadmin/invitations')).status).toBe(401);
  });

  it('rejects a claimed link on revoke, and re-revoking is a no-op', async () => {
    const claimant = await createUser('c@example.com');
    const claimedInvite = await seedInvitation(String(superadmin._id));
    await claimInvitation(String(claimant._id), (await Invitation.findById(claimedInvite.id))!.token);
    const rejected = await request(app)
      .patch(`/api/superadmin/invitations/${claimedInvite.id}/revoke`)
      .set('Authorization', superToken);
    expect(rejected.status).toBe(409);

    const other = await seedInvitation(String(superadmin._id));
    const first = await revokeInvitation(other.id);
    const second = await revokeInvitation(other.id);
    expect(second.status).toBe('revoked');
    expect(second.claimedAt).toBeNull();
    expect(first.expiresAt).toBe(second.expiresAt);
  });

  it('404s an unknown invitation id on revoke', async () => {
    const res = await request(app)
      .patch(`/api/superadmin/invitations/${new mongoose.Types.ObjectId().toString()}/revoke`)
      .set('Authorization', superToken);
    expect(res.status).toBe(404);
  });

  it('rejects a malformed :id with 400 (never a CastError 500)', async () => {
    const res = await request(app)
      .patch('/api/superadmin/invitations/not-an-objectid/revoke')
      .set('Authorization', superToken);
    expect(res.status).toBe(400);
  });

  it('rejects free plan, out-of-range expiry, and an overlong label', async () => {
    const bad: Array<Record<string, unknown>> = [
      { planSlug: 'free', grantDuration: 'one_year' },
      { planSlug: 'pro', grantDuration: 'one_year', expiresInDays: 0 },
      { planSlug: 'pro', grantDuration: 'one_year', expiresInDays: 366 },
      { planSlug: 'pro', grantDuration: 'one_year', label: 'x'.repeat(121) },
      { planSlug: 'pro', grantDuration: 'forever' },
    ];
    for (const body of bad) {
      const res = await request(app)
        .post('/api/superadmin/invitations')
        .set('Authorization', superToken)
        .send(body);
      expect(res.status).toBe(400);
    }
  });

  it('defaults the link expiry to 30 days and the label to empty', async () => {
    const res = await request(app)
      .post('/api/superadmin/invitations')
      .set('Authorization', superToken)
      .send({ planSlug: 'pro', grantDuration: 'one_month' });
    expect(res.status).toBe(201);
    expect(res.body.invitation.label).toBe('');
    const days = (Date.parse(res.body.invitation.expiresAt) - Date.now()) / DAY;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });
});

// ---------------------------------------------------------------------------
// Public resolve
// ---------------------------------------------------------------------------

describe('public invitation resolve', () => {
  it('emits only { plan, grantDuration, expiresAt, status } — unauthenticated', async () => {
    const superadmin = await createUser('root@example.com', ROLE_SUPERADMIN);
    const invite = await seedInvitation(String(superadmin._id), { label: 'li-secret' });
    const row = (await Invitation.findById(invite.id))!;

    const res = await request(app).get(`/api/invitations/${row.token}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['expiresAt', 'grantDuration', 'plan', 'status']);
    expect(res.body).toMatchObject({ plan: 'business', grantDuration: 'one_year', status: 'pending' });
    for (const leak of ['label', 'claimedBy', 'createdBy', '_id', 'id', 'token']) {
      expect(res.body[leak]).toBeUndefined();
    }
  });

  it('resolves dead links with their status', async () => {
    const superadmin = await createUser('root@example.com', ROLE_SUPERADMIN);
    const expired = await seedInvitation(String(superadmin._id));
    await Invitation.updateOne({ _id: expired.id }, { $set: { expiresAt: new Date(Date.now() - 1) } });
    const expiredRow = (await Invitation.findById(expired.id))!;
    expect((await request(app).get(`/api/invitations/${expiredRow.token}`)).body.status).toBe('expired');

    const revoked = await seedInvitation(String(superadmin._id));
    await revokeInvitation(revoked.id);
    const revokedRow = (await Invitation.findById(revoked.id))!;
    expect((await request(app).get(`/api/invitations/${revokedRow.token}`)).body.status).toBe('revoked');
  });

  it('404s an unknown token and 400s a malformed one', async () => {
    expect((await request(app).get('/api/invitations/unknowntoken')).status).toBe(404);
    expect((await request(app).get('/api/invitations/bad%20token')).status).toBe(400);
    await expect(getPublicInvitation('nope')).rejects.toMatchObject({ status: 404 });
  });
});

// ---------------------------------------------------------------------------
// Claim
// ---------------------------------------------------------------------------

describe('invitation claim', () => {
  let superadmin: UserHydrated;
  let claimant: UserHydrated;

  beforeEach(async () => {
    superadmin = await createUser('root@example.com', ROLE_SUPERADMIN);
    claimant = await createUser('claimant@example.com');
  });

  it('grants the plan through HTTP and stamps the correct period end', async () => {
    const invite = await seedInvitation(String(superadmin._id), { planSlug: 'pro', grantDuration: 'one_month' });
    const row = (await Invitation.findById(invite.id))!;

    const res = await request(app)
      .post(`/api/invitations/${row.token}/claim`)
      .set('Authorization', tokenFor(claimant));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ plan: 'pro', grantDuration: 'one_month' });

    const grant = await Subscription.findOne({ userId: claimant._id });
    expect(grant?.providerSubscriptionId).toBe(`${INVITE_GRANT_PREFIX}${invite.id}`);
    expect(grant?.status).toBe('active');
    expect(grant?.planSlug).toBe('pro');
    expect(grant?.customerId).toBeNull();
    expect(grant?.currentPeriodEnd?.toISOString()).toBe(res.body.currentPeriodEnd);
    expect((await resolveEntitlements(String(claimant._id))).slug).toBe('pro');
  });

  it('requires authentication and email verification', async () => {
    const invite = await seedInvitation(String(superadmin._id));
    const row = (await Invitation.findById(invite.id))!;
    expect((await request(app).post(`/api/invitations/${row.token}/claim`)).status).toBe(401);

    const unverified = await createUser('new@example.com', ROLE_MEMBER, { emailVerified: false });
    const res = await request(app)
      .post(`/api/invitations/${row.token}/claim`)
      .set('Authorization', tokenFor(unverified));
    expect(res.status).toBe(403);
  });

  it('computes the year window from the claim instant', async () => {
    const invite = await seedInvitation(String(superadmin._id), { grantDuration: 'one_year' });
    const row = (await Invitation.findById(invite.id))!;
    const now = new Date('2025-06-01T12:00:00Z');
    const result = await claimInvitation(String(claimant._id), row.token, now);
    expect(result.currentPeriodEnd.toISOString()).toBe('2026-06-01T12:00:00.000Z');
    expect(result.claimantEmail).toBe('claimant@example.com');
    expect(result.claimantName).toBe('Ada Lovelace');
  });

  it('tolerates a claimant row that no longer exists', async () => {
    const invite = await seedInvitation(String(superadmin._id));
    const row = (await Invitation.findById(invite.id))!;
    const ghost = new mongoose.Types.ObjectId().toString();
    const result = await claimInvitation(ghost, row.token);
    expect(result.claimantEmail).toBe('');
    expect(result.claimantName).toBe('');
  });

  it('rejects expired, revoked, already-claimed, and unknown links with distinct keys', async () => {
    const expired = await seedInvitation(String(superadmin._id));
    await Invitation.updateOne({ _id: expired.id }, { $set: { expiresAt: new Date(Date.now() - 1) } });
    const expiredRow = (await Invitation.findById(expired.id))!;
    await expect(claimInvitation(String(claimant._id), expiredRow.token)).rejects.toMatchObject({
      status: 409,
      message: 'invitations.error.expired',
    });

    const revoked = await seedInvitation(String(superadmin._id));
    await revokeInvitation(revoked.id);
    const revokedRow = (await Invitation.findById(revoked.id))!;
    await expect(claimInvitation(String(claimant._id), revokedRow.token)).rejects.toMatchObject({
      status: 409,
      message: 'invitations.error.revoked',
    });

    const used = await seedInvitation(String(superadmin._id));
    const usedRow = (await Invitation.findById(used.id))!;
    const other = await createUser('other@example.com');
    await claimInvitation(String(other._id), usedRow.token);
    await expect(claimInvitation(String(claimant._id), usedRow.token)).rejects.toMatchObject({
      status: 409,
      message: 'invitations.error.alreadyClaimed',
    });

    await expect(claimInvitation(String(claimant._id), 'nosuchtoken')).rejects.toMatchObject({
      status: 404,
      message: 'invitations.error.notFound',
    });
  });

  it('refuses to clobber an active paid subscription and leaves the link pending', async () => {
    await Subscription.create({
      userId: claimant._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_polar_1',
      productId: 'prod_pro',
      planSlug: 'pro',
      status: 'active',
    });
    const invite = await seedInvitation(String(superadmin._id));
    const row = (await Invitation.findById(invite.id))!;
    await expect(claimInvitation(String(claimant._id), row.token)).rejects.toMatchObject({
      status: 409,
      message: 'invitations.error.alreadySubscribed',
    });
    expect((await Invitation.findById(invite.id))!.claimedAt).toBeNull();
  });

  it('refuses a past_due subscriber still inside the grace window', async () => {
    await Subscription.create({
      userId: claimant._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_polar_2',
      productId: 'prod_pro',
      planSlug: 'pro',
      status: 'past_due',
      graceEndsAt: new Date(Date.now() + DAY),
    });
    const invite = await seedInvitation(String(superadmin._id));
    const row = (await Invitation.findById(invite.id))!;
    await expect(claimInvitation(String(claimant._id), row.token)).rejects.toMatchObject({ status: 409 });
  });

  it('allows a claim when the only rows are free, lapsed-grace, canceled, or an elapsed grant', async () => {
    const cases: Array<Record<string, unknown>> = [
      { providerSubscriptionId: 'sub_free', planSlug: 'free', status: 'active' },
      { providerSubscriptionId: 'sub_pastdue_nograce', planSlug: 'pro', status: 'past_due' },
      { providerSubscriptionId: 'sub_canceled', planSlug: 'pro', status: 'canceled' },
      {
        providerSubscriptionId: `${INVITE_GRANT_PREFIX}${new mongoose.Types.ObjectId().toString()}`,
        planSlug: 'business',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() - DAY),
      },
    ];
    for (const [index, over] of cases.entries()) {
      await clearCollections();
      const admin = await createUser('root@example.com', ROLE_SUPERADMIN);
      const user = await createUser(`u${index}@example.com`);
      await Subscription.create({ userId: user._id, provider: 'polar', productId: 'p', ...over });
      const invite = await seedInvitation(String(admin._id));
      const row = (await Invitation.findById(invite.id))!;
      await expect(claimInvitation(String(user._id), row.token)).resolves.toMatchObject({
        planSlug: 'business',
      });
    }
  });

  it('lets exactly one of two concurrent claimers win', async () => {
    const invite = await seedInvitation(String(superadmin._id));
    const row = (await Invitation.findById(invite.id))!;
    const second = await createUser('second@example.com');

    const results = await Promise.allSettled([
      claimInvitation(String(claimant._id), row.token),
      claimInvitation(String(second._id), row.token),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(await Subscription.countDocuments({ providerSubscriptionId: /^invite-grant-/ })).toBe(1);
  });

  it('compensates the claim when the grant insert fails, returning the link to pending', async () => {
    const invite = await seedInvitation(String(superadmin._id));
    const row = (await Invitation.findById(invite.id))!;
    vi.spyOn(Subscription, 'create').mockImplementationOnce((() => {
      throw new Error('insert failed');
    }) as never);

    await expect(claimInvitation(String(claimant._id), row.token)).rejects.toThrow('insert failed');
    const after = (await Invitation.findById(invite.id))!;
    expect(after.claimedAt).toBeNull();
    expect(after.claimedBy).toBeNull();
    expect(deriveInvitationStatus(after, new Date())).toBe('pending');
  });
});

// ---------------------------------------------------------------------------
// Entitlements + sweep + supersede + reconcile
// ---------------------------------------------------------------------------

describe('invite-grant entitlement enforcement', () => {
  let user: UserHydrated;

  beforeEach(async () => {
    user = await createUser('grantee@example.com');
  });

  async function seedGrant(over: Partial<{ planSlug: string; currentPeriodEnd: Date; status: string }> = {}) {
    return Subscription.create({
      userId: user._id,
      provider: 'polar',
      providerSubscriptionId: `${INVITE_GRANT_PREFIX}${new mongoose.Types.ObjectId().toString()}`,
      productId: 'invite-grant',
      planSlug: over.planSlug ?? 'business',
      status: over.status ?? 'active',
      currentPeriodEnd: over.currentPeriodEnd ?? new Date(Date.now() + DAY),
    });
  }

  it('entitles a live grant and drops an elapsed one to free at read time', async () => {
    await seedGrant();
    expect((await resolveEntitlements(String(user._id))).slug).toBe('business');

    await Subscription.updateOne(
      { userId: user._id },
      { $set: { currentPeriodEnd: new Date(Date.now() - 1) } },
    );
    expect((await resolveEntitlements(String(user._id))).slug).toBe('free');
    // The row is untouched until the sweep runs — enforcement is at read time.
    expect((await Subscription.findOne({ userId: user._id }))!.status).toBe('active');
  });

  it('regression: a Polar active row with a past currentPeriodEnd stays entitled', async () => {
    await Subscription.create({
      userId: user._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_polar_stale',
      productId: 'prod_pro',
      planSlug: 'pro',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() - 30 * DAY),
    });
    expect((await resolveEntitlements(String(user._id))).slug).toBe('pro');
  });

  it('PAYMENT_PROVIDER=none still returns the business ceiling', async () => {
    env.PAYMENT_PROVIDER = 'none';
    await seedGrant({ currentPeriodEnd: new Date(Date.now() - DAY) });
    expect((await resolveEntitlements(String(user._id))).slug).toBe('business');
  });

  it('sweep demotes only elapsed grants and pauses over-cap projects', async () => {
    await seedProject(String(user._id), 'p1');
    await seedProject(String(user._id), 'p2');
    const elapsed = await seedGrant({ currentPeriodEnd: new Date(Date.now() - DAY) });

    const live = await createUser('live@example.com');
    await Subscription.create({
      userId: live._id,
      provider: 'polar',
      providerSubscriptionId: `${INVITE_GRANT_PREFIX}${new mongoose.Types.ObjectId().toString()}`,
      productId: 'invite-grant',
      planSlug: 'pro',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + DAY),
    });
    const paid = await createUser('paid@example.com');
    await Subscription.create({
      userId: paid._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_polar_live',
      productId: 'prod_pro',
      planSlug: 'pro',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() - DAY),
    });

    const summary = await sweepExpiredInviteGrants();
    expect(summary).toEqual({ scanned: 1, expired: 1, paused: 1 });

    const swept = (await Subscription.findById(elapsed._id))!;
    expect(swept.status).toBe('canceled');
    expect(swept.planSlug).toBe('free');
    expect(await Project.countDocuments({ owner: user._id, paused: true })).toBe(1);
    // Free cap is 1 project — the oldest stays active, never deleted.
    expect(await Project.countDocuments({ owner: user._id })).toBe(2);

    expect((await Subscription.findOne({ userId: live._id }))!.status).toBe('active');
    expect((await Subscription.findOne({ userId: paid._id }))!.status).toBe('active');
  });

  it('sweep logs and continues when a row fails', async () => {
    await seedGrant({ currentPeriodEnd: new Date(Date.now() - DAY) });
    vi.spyOn(Subscription, 'updateOne').mockImplementationOnce(
      (() => Promise.reject(new Error('write failed'))) as never,
    );
    const summary = await sweepExpiredInviteGrants();
    expect(summary).toEqual({ scanned: 1, expired: 0, paused: 0 });
  });

  it('cancelLiveInviteGrants only touches this user’s live grants', async () => {
    await seedGrant();
    const other = await createUser('other@example.com');
    await Subscription.create({
      userId: other._id,
      provider: 'polar',
      providerSubscriptionId: `${INVITE_GRANT_PREFIX}${new mongoose.Types.ObjectId().toString()}`,
      productId: 'invite-grant',
      planSlug: 'pro',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + DAY),
    });
    expect(await cancelLiveInviteGrants(String(user._id))).toBe(1);
    expect(await cancelLiveInviteGrants(String(user._id))).toBe(0);
    expect((await Subscription.findOne({ userId: other._id }))!.status).toBe('active');
  });

  it('a Polar activation supersedes a live grant', async () => {
    await seedGrant({ planSlug: 'pro' });
    const event: ParsedEvent = {
      eventId: 'evt_1',
      type: 'subscription.active',
      timestamp: '0',
      payload: {
        kind: 'subscription',
        action: 'active',
        subscription: {
          providerSubscriptionId: 'sub_polar_new',
          providerCustomerId: 'cust_1',
          productId: 'prod_pro',
          status: 'active',
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
          externalCustomerId: String(user._id),
        } as NormalizedSubscription,
        customer: { providerCustomerId: 'cust_1', email: 'grantee@example.com' },
      },
    };
    expect(await dispatchEvent('polar', event)).toEqual({ status: 'processed' });

    const grant = await Subscription.findOne({ providerSubscriptionId: /^invite-grant-/ });
    expect(grant!.status).toBe('canceled');
    const purchased = await Subscription.findOne({ providerSubscriptionId: 'sub_polar_new' });
    expect(purchased!.status).toBe('active');
  });

  it('reconcile never heals a grant row', async () => {
    const grant = await seedGrant();
    const provider: IPaymentProvider = {
      name: 'polar',
      isConfigured: () => true,
      createCheckout: async () => ({ url: '', providerCheckoutId: '' }),
      openPortal: async () => ({ url: '' }),
      changePlan: async () => ({}) as never,
      verifyWebhook: () => undefined,
      parseEvent: () => ({ eventId: '', type: '', timestamp: '0', payload: { kind: 'unknown', rawType: '' } }),
      listActiveSubscriptions: async () => [],
      getSubscription: async () => null,
    };
    const summary = await reconcileSubscriptions(provider);
    expect(summary).toEqual({ polled: 0, healed: 0, errors: 0 });
    const after = (await Subscription.findById(grant._id))!;
    expect(after.status).toBe('active');
    expect(after.planSlug).toBe('business');
  });
});

// ---------------------------------------------------------------------------
// Operator notification
// ---------------------------------------------------------------------------

describe('invitation claimed notification', () => {
  let superadmin: UserHydrated;
  let claimant: UserHydrated;

  beforeEach(async () => {
    superadmin = await createUser('root@example.com', ROLE_SUPERADMIN);
    claimant = await createUser('claimant@example.com');
  });

  /** Each claim needs a fresh user: a grantee already holds a paid plan. */
  async function claimOverHttp(user: UserHydrated = claimant): Promise<number> {
    const invite = await seedInvitation(String(superadmin._id), { label: 'li-ada' });
    const row = (await Invitation.findById(invite.id))!;
    const res = await request(app)
      .post(`/api/invitations/${row.token}/claim`)
      .set('Authorization', tokenFor(user));
    return res.status;
  }

  it('mails the operator inbox with a plaintext body', async () => {
    env.CONTACT_RECIPIENT = 'ops@dockstash.com';
    env.RESEND_API_KEY = 'key';
    env.RESEND_FROM = 'no-reply@dockstash.com';
    const sent: EmailMessage[] = [];
    setResendTransport(async (message) => {
      sent.push(message);
      return { delivered: true };
    });

    expect(await claimOverHttp()).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe('ops@dockstash.com');
    expect(sent[0]!.subject).toContain('business');
    expect(sent[0]!.html).toBeUndefined();
    expect(sent[0]!.text).toContain('claimant@example.com');
    expect(sent[0]!.text).toContain('li-ada');
    expect(sent[0]!.text).toContain('/superadmin?tab=invitations');
  });

  it('skips the send when CONTACT_RECIPIENT is unset', async () => {
    env.RESEND_API_KEY = 'key';
    env.RESEND_FROM = 'no-reply@dockstash.com';
    const sent: EmailMessage[] = [];
    setResendTransport(async (message) => {
      sent.push(message);
      return { delivered: true };
    });
    expect(await claimOverHttp()).toBe(200);
    expect(sent).toHaveLength(0);
  });

  it('skips the send when Resend is unconfigured, and survives a throwing transport', async () => {
    env.CONTACT_RECIPIENT = 'ops@dockstash.com';
    expect(await claimOverHttp()).toBe(200);

    env.RESEND_API_KEY = 'key';
    env.RESEND_FROM = 'no-reply@dockstash.com';
    setResendTransport(async () => {
      throw new Error('resend down');
    });
    expect(await claimOverHttp(await createUser('second@example.com'))).toBe(200);
  });
});
