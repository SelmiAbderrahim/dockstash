import { env } from '../../config/env.js';
import { HttpError } from '../../shared/utils/http-error.js';
import { AuditLog, recordAudit } from '../audit/index.js';
import { Customer, Subscription } from '../billing/index.js';
import { Project } from '../backups/index.js';
import { Schedule } from '../scheduler/index.js';
import { runHealthCheck, type HealthDeps } from '../health/index.js';
import {
  scheduleAccountDeletion,
  type AccountDeletionScheduled,
  type PurgeQueue,
  type ScheduleAccountDeletionDeps,
  type WarningMailer,
} from '../legal/index.js';
import { LoginChallenge } from '../auth/login-challenge.model.js';
import {
  ROLE_SUPERADMIN,
  User,
  toPublicUser,
  type AssignableRole,
  type UserHydrated,
} from '../users/index.js';

const SECURITY_EVENT_ACTIONS = [
  'auth.otp.challenge',
  'auth.otp.success',
  'auth.otp.failure',
  'auth.newDevice',
] as const;

export type AdminUser = ReturnType<typeof toAdminUser>;

/** PublicUser plus the moderation fields the superadmin console manages. */
export function toAdminUser(user: UserHydrated) {
  return {
    ...toPublicUser(user),
    legalHold: user.legalHold,
    deletionScheduledAt: user.deletionScheduledAt?.toISOString() ?? null,
    language: user.language ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

function serializeAuditEntry(entry: {
  _id: { toString(): string };
  actorUserId: { toString(): string };
  action: string;
  targetType: string;
  targetId: string;
  ip: string;
  metadata: unknown;
  createdAt: Date;
}): GlobalAuditResult['entries'][number] {
  return {
    id: entry._id.toString(),
    actorUserId: entry.actorUserId.toString(),
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    ip: entry.ip,
    metadata: entry.metadata as Record<string, unknown>,
    createdAt: entry.createdAt.toISOString(),
  };
}

export interface SuperadminStats {
  users: { total: number; new7d: number; new30d: number; verifiedPct: number };
  subscriptions: Array<{ planSlug: string; status: string; count: number }>;
  projects: { total: number; paused: number };
  backups: { projectsWithSuccess: number };
  snapshots: { total: number; repoBytes: number };
}

export async function collectStats(now = new Date()): Promise<SuperadminStats> {
  const day = 24 * 60 * 60 * 1000;
  const [total, verified, new7d, new30d] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ emailVerified: true }),
    User.countDocuments({ createdAt: { $gte: new Date(now.getTime() - 7 * day) } }),
    User.countDocuments({ createdAt: { $gte: new Date(now.getTime() - 30 * day) } }),
  ]);

  const subscriptionGroups = await Subscription.aggregate<{
    _id: { planSlug: string; status: string };
    count: number;
  }>([{ $group: { _id: { planSlug: '$planSlug', status: '$status' }, count: { $sum: 1 } } }]);

  const [projectsTotal, projectsPaused, projectsWithSuccess] = await Promise.all([
    Project.countDocuments(),
    Project.countDocuments({ paused: true }),
    Project.countDocuments({ lastSuccessAt: { $ne: null } }),
  ]);

  const snapshotTotals = await Project.aggregate<{
    _id: null;
    total: number;
    repoBytes: number;
  }>([
    {
      $group: {
        _id: null,
        total: { $sum: '$snapshotCount' },
        repoBytes: { $sum: '$totalRepoBytes' },
      },
    },
  ]);

  return {
    users: {
      total,
      new7d,
      new30d,
      verifiedPct: total ? Math.round((verified / total) * 100) : 0,
    },
    subscriptions: subscriptionGroups
      .map((group) => ({
        planSlug: group._id.planSlug,
        status: group._id.status,
        count: group.count,
      }))
      .sort((a, b) => a.planSlug.localeCompare(b.planSlug) || a.status.localeCompare(b.status)),
    projects: { total: projectsTotal, paused: projectsPaused },
    backups: { projectsWithSuccess },
    snapshots: {
      total: snapshotTotals[0]?.total ?? 0,
      repoBytes: snapshotTotals[0]?.repoBytes ?? 0,
    },
  };
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface ListUsersInput {
  page: number;
  limit: number;
  search?: string;
}

export interface ListUsersResult {
  users: AdminUser[];
  total: number;
  page: number;
  pages: number;
}

export async function listUsers(input: ListUsersInput): Promise<ListUsersResult> {
  const filter: Record<string, unknown> = {};
  if (input.search) {
    const pattern = new RegExp(escapeRegExp(input.search), 'i');
    filter.$or = [
      { email: pattern },
      { 'profile.firstName': pattern },
      { 'profile.lastName': pattern },
    ];
  }
  const [docs, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((input.page - 1) * input.limit)
      .limit(input.limit),
    User.countDocuments(filter),
  ]);
  return {
    users: docs.map(toAdminUser),
    total,
    page: input.page,
    pages: Math.ceil(total / input.limit),
  };
}

async function loadModifiableTarget(targetId: string): Promise<UserHydrated> {
  const target = await User.findById(targetId);
  if (!target) throw HttpError.notFound('errors.userNotFound');
  if (target.role === ROLE_SUPERADMIN) {
    throw HttpError.forbidden('superadmin.error.cannotModifySuperadmin');
  }
  return target;
}

export async function changeUserRole(
  actorId: string,
  targetId: string,
  role: AssignableRole,
  ip: string,
): Promise<AdminUser> {
  const target = await loadModifiableTarget(targetId);
  target.role = role;
  await target.save();
  await recordAudit({
    actorUserId: actorId,
    action: 'superadmin.role.change',
    targetType: 'user',
    targetId,
    ip,
    metadata: { role },
  });
  return toAdminUser(target);
}

export async function verifyUserEmail(
  actorId: string,
  targetId: string,
  ip: string,
): Promise<AdminUser> {
  const target = await User.findById(targetId);
  if (!target) throw HttpError.notFound('errors.userNotFound');
  target.emailVerified = true;
  target.emailVerificationToken = undefined;
  target.emailVerificationExpires = undefined;
  await target.save();
  await recordAudit({
    actorUserId: actorId,
    action: 'superadmin.user.verify',
    targetType: 'user',
    targetId,
    ip,
  });
  return toAdminUser(target);
}

export async function setLegalHold(
  actorId: string,
  targetId: string,
  legalHold: boolean,
  ip: string,
): Promise<AdminUser> {
  const target = await loadModifiableTarget(targetId);
  target.legalHold = legalHold;
  await target.save();
  await recordAudit({
    actorUserId: actorId,
    action: 'superadmin.user.legalHold',
    targetType: 'user',
    targetId,
    ip,
    metadata: { legalHold },
  });
  return toAdminUser(target);
}

export interface ScheduleUserDeletionDeps {
  queue: PurgeQueue;
  mailer?: WarningMailer;
  t?: ScheduleAccountDeletionDeps['t'];
  locale?: string;
}

export async function scheduleUserDeletion(
  actorId: string,
  targetId: string,
  deps: ScheduleUserDeletionDeps,
  ip: string,
): Promise<AccountDeletionScheduled> {
  // Superadmin guard first; the legal service then applies its own
  // legal-hold / already-scheduled guards.
  await loadModifiableTarget(targetId);
  const result = await scheduleAccountDeletion(targetId, {
    t: deps.t,
    graceHours: env.ACCOUNT_DELETION_GRACE_HOURS,
    queue: deps.queue,
    mailer: deps.mailer,
    locale: deps.locale,
  });
  await recordAudit({
    actorUserId: actorId,
    action: 'superadmin.user.delete',
    targetType: 'user',
    targetId,
    ip,
    metadata: { purgeAt: result.purgeAt },
  });
  return result;
}

export interface BillingOverviewInput {
  page: number;
  limit: number;
}

export interface BillingOverview {
  customers: Array<{
    id: string;
    userId: string;
    provider: string;
    providerCustomerId: string;
    email: string;
    createdAt: string;
    subscriptions: Array<{
      id: string;
      planSlug: string;
      status: string;
      cancelAtPeriodEnd: boolean;
      currentPeriodEnd: string | null;
    }>;
  }>;
  total: number;
  page: number;
  pages: number;
}

export async function getBillingOverview(input: BillingOverviewInput): Promise<BillingOverview> {
  const [customers, total] = await Promise.all([
    Customer.find()
      .sort({ createdAt: -1 })
      .skip((input.page - 1) * input.limit)
      .limit(input.limit),
    Customer.countDocuments(),
  ]);
  const customerIds = customers.map((customer) => customer._id);
  const subscriptions = await Subscription.find({ customerId: { $in: customerIds } });
  return {
    customers: customers.map((customer) => ({
      id: customer._id.toString(),
      userId: customer.userId.toString(),
      provider: customer.provider,
      providerCustomerId: customer.providerCustomerId,
      email: customer.email,
      createdAt: customer.createdAt.toISOString(),
      subscriptions: subscriptions
        .filter((sub) => sub.customerId.toString() === customer._id.toString())
        .map((sub) => ({
          id: sub._id.toString(),
          planSlug: sub.planSlug,
          status: sub.status,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
        })),
    })),
    total,
    page: input.page,
    pages: Math.ceil(total / input.limit),
  };
}

export interface GlobalAuditInput {
  page: number;
  limit: number;
  action?: string;
  actorUserId?: string;
  from?: Date;
  to?: Date;
}

export interface GlobalAuditResult {
  entries: Array<{
    id: string;
    actorUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    ip: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
  total: number;
  page: number;
  pages: number;
}

export async function listGlobalAudit(input: GlobalAuditInput): Promise<GlobalAuditResult> {
  const filter: Record<string, unknown> = {};
  if (input.action) filter.action = input.action;
  if (input.actorUserId) filter.actorUserId = input.actorUserId;
  if (input.from || input.to) {
    const createdAt: Record<string, Date> = {};
    if (input.from) createdAt.$gte = input.from;
    if (input.to) createdAt.$lte = input.to;
    filter.createdAt = createdAt;
  }
  const [entries, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((input.page - 1) * input.limit)
      .limit(input.limit),
    AuditLog.countDocuments(filter),
  ]);
  return {
    entries: entries.map(serializeAuditEntry),
    total,
    page: input.page,
    pages: Math.ceil(total / input.limit),
  };
}

export interface SystemSummary {
  health: Awaited<ReturnType<typeof runHealthCheck>>;
  scheduler: { schedules: number; enabled: number };
  security: {
    recentChallenges: Array<{
      id: string;
      userId: string;
      ip: string;
      attempts: number;
      consumedAt: string | null;
      expiresAt: string;
      createdAt: string;
    }>;
    recentEvents: GlobalAuditResult['entries'];
  };
}

export async function getSystemSummary(deps: HealthDeps = {}): Promise<SystemSummary> {
  const [health, schedules, enabled, challenges, events] = await Promise.all([
    runHealthCheck(deps),
    Schedule.countDocuments(),
    Schedule.countDocuments({ enabled: true }),
    LoginChallenge.find().sort({ createdAt: -1 }).limit(50),
    AuditLog.find({ action: { $in: [...SECURITY_EVENT_ACTIONS] } })
      .sort({ createdAt: -1 })
      .limit(50),
  ]);
  return {
    health,
    scheduler: { schedules, enabled },
    security: {
      // Serialization deliberately excludes codeHash/secret.
      recentChallenges: challenges.map((challenge) => ({
        id: challenge._id.toString(),
        userId: challenge.userId.toString(),
        ip: challenge.ip,
        attempts: challenge.attempts,
        consumedAt: challenge.consumedAt?.toISOString() ?? null,
        expiresAt: challenge.expiresAt.toISOString(),
        createdAt: challenge.createdAt.toISOString(),
      })),
      recentEvents: events.map(serializeAuditEntry),
    },
  };
}
