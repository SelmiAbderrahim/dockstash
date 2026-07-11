// Shapes mirror the server responses in server/src/modules/superadmin.

export interface SuperadminStats {
  users: { total: number; new7d: number; new30d: number; verifiedPct: number };
  subscriptions: Array<{ planSlug: string; status: string; count: number }>;
  projects: { total: number; paused: number };
  backups: { projectsWithSuccess: number };
  snapshots: { total: number; repoBytes: number };
}

export interface SuperadminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  emailVerified: boolean;
  legalHold: boolean;
  deletionScheduledAt: string | null;
  language: string | null;
  createdAt: string;
}

export interface SuperadminUsersPage {
  users: SuperadminUser[];
  total: number;
  page: number;
  pages: number;
}

export interface SuperadminSubscription {
  id: string;
  planSlug: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

export interface SuperadminCustomer {
  id: string;
  userId: string;
  provider: string;
  providerCustomerId: string;
  email: string;
  createdAt: string;
  subscriptions: SuperadminSubscription[];
}

export interface SuperadminBillingPage {
  customers: SuperadminCustomer[];
  total: number;
  page: number;
  pages: number;
}

export interface SuperadminAuditEntry {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  ip: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SuperadminAuditPage {
  entries: SuperadminAuditEntry[];
  total: number;
  page: number;
  pages: number;
}

export interface AuditFilters {
  action: string;
  actorUserId: string;
  from: string;
  to: string;
}

export interface SuperadminChallenge {
  id: string;
  userId: string;
  ip: string;
  attempts: number;
  consumedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface SuperadminSystem {
  health: {
    status: 'ok' | 'degraded';
    db: boolean;
    redis: boolean;
    redisConfigured: boolean;
    timestamp: string;
  };
  scheduler: { schedules: number; enabled: number };
  security: {
    recentChallenges: SuperadminChallenge[];
    recentEvents: SuperadminAuditEntry[];
  };
}

export type InvitationStatus = 'pending' | 'claimed' | 'expired' | 'revoked';
export type GrantDuration = 'one_month' | 'one_year';
export type GrantablePlan = 'pro' | 'business';

export interface SuperadminInvitation {
  id: string;
  /** Superadmin-only: the raw token, used to build the `/invite/:token` URL. */
  token: string;
  plan: GrantablePlan;
  grantDuration: GrantDuration;
  label: string;
  expiresAt: string;
  claimedAt: string | null;
  claimedByEmail: string | null;
  createdAt: string;
  status: InvitationStatus;
}

export interface SuperadminInvitationsPage {
  invitations: SuperadminInvitation[];
  total: number;
  page: number;
  pages: number;
}

export interface CreateInvitationInput {
  planSlug: GrantablePlan;
  grantDuration: GrantDuration;
  expiresInDays: number;
  label?: string;
}

export interface InvitationMutationResponse {
  message: string;
  invitation: SuperadminInvitation;
}

export interface MutationResponse {
  message: string;
  user: SuperadminUser;
}

export interface DeletionResponse {
  message: string;
  scheduledAt: string;
  purgeAt: string;
  warningEmailQueued: boolean;
}

export interface SuperadminState {
  stats: SuperadminStats | null;
  loadingStats: boolean;
  users: SuperadminUsersPage | null;
  loadingUsers: boolean;
  usersSearch: string;
  billing: SuperadminBillingPage | null;
  loadingBilling: boolean;
  audit: SuperadminAuditPage | null;
  loadingAudit: boolean;
  auditFilters: AuditFilters;
  system: SuperadminSystem | null;
  loadingSystem: boolean;
  invitations: SuperadminInvitationsPage | null;
  loadingInvitations: boolean;
  actionPending: boolean;
  error: string;
  message: string;
}
