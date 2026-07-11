import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { HttpError } from '../../shared/utils/http-error.js';
import { requireUserId } from '../../shared/utils/require-user-id.js';
import { extractIp } from '../audit/index.js';
import {
  createInvitation,
  createInvitationSchema,
  invitationIdParamsSchema,
  listInvitations,
  listInvitationsSchema,
  revokeInvitation,
} from '../billing/index.js';
import type { PurgeQueue, WarningMailer } from '../legal/index.js';
import {
  changeUserRole,
  collectStats,
  getBillingOverview,
  getSystemSummary,
  listGlobalAudit,
  listUsers,
  scheduleUserDeletion,
  setLegalHold,
  verifyUserEmail,
} from './superadmin.service.js';
import {
  auditQuerySchema,
  billingQuerySchema,
  changeRoleSchema,
  legalHoldSchema,
  listUsersQuerySchema,
  userIdParamsSchema,
} from './superadmin.schema.js';

// Purge queue + warning mailer are injectable, mirroring the legal controller:
// production wiring calls `configureSuperadminController` at boot.
let queue: PurgeQueue | null = null;
let mailer: WarningMailer | null = null;

export interface ConfigureSuperadminControllerDeps {
  queue: PurgeQueue;
  mailer?: WarningMailer;
}

export function configureSuperadminController(deps: ConfigureSuperadminControllerDeps): void {
  queue = deps.queue;
  mailer = deps.mailer ?? null;
}

export function resetSuperadminController(): void {
  queue = null;
  mailer = null;
}

export const getStats: RequestHandler = asyncHandler(async (_req, res) => {
  res.status(200).json(await collectStats());
});

export const listUsersHandler: RequestHandler = asyncHandler(async (req, res) => {
  const query = listUsersQuerySchema.parse(req.query);
  res.status(200).json(await listUsers(query));
});

export const changeRole: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = userIdParamsSchema.parse(req.params);
  const { role } = changeRoleSchema.parse(req.body);
  const user = await changeUserRole(requireUserId(req.user), id, role, extractIp(req));
  res.status(200).json({ message: req.t('superadmin.success.roleChanged'), user });
});

export const verifyUser: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = userIdParamsSchema.parse(req.params);
  const user = await verifyUserEmail(requireUserId(req.user), id, extractIp(req));
  res.status(200).json({ message: req.t('superadmin.success.userVerified'), user });
});

export const updateLegalHold: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = userIdParamsSchema.parse(req.params);
  const { legalHold } = legalHoldSchema.parse(req.body);
  const user = await setLegalHold(requireUserId(req.user), id, legalHold, extractIp(req));
  res.status(200).json({ message: req.t('superadmin.success.legalHoldUpdated'), user });
});

export const deleteUser: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = userIdParamsSchema.parse(req.params);
  if (!queue) {
    throw HttpError.internal('security.deletion.notConfigured');
  }
  const result = await scheduleUserDeletion(
    requireUserId(req.user),
    id,
    { queue, mailer: mailer ?? undefined, t: req.t, locale: req.language },
    extractIp(req),
  );
  res
    .status(202)
    .json({ message: req.t('superadmin.success.deletionScheduled'), ...result });
});

export const getBilling: RequestHandler = asyncHandler(async (req, res) => {
  const query = billingQuerySchema.parse(req.query);
  res.status(200).json(await getBillingOverview(query));
});

export const getAudit: RequestHandler = asyncHandler(async (req, res) => {
  const query = auditQuerySchema.parse(req.query);
  res.status(200).json(await listGlobalAudit(query));
});

export const getSystem: RequestHandler = asyncHandler(async (_req, res) => {
  res.status(200).json(await getSystemSummary());
});

// Invitation links. Business logic lives in the billing module's public API;
// these handlers stay thin (parse → delegate → respond), and auth/role gating
// comes from the `/api/superadmin` mount in app.ts.

export const createInvitationHandler: RequestHandler = asyncHandler(async (req, res) => {
  const input = createInvitationSchema.parse(req.body);
  const invitation = await createInvitation(requireUserId(req.user), input);
  res
    .status(201)
    .json({ message: req.t('superadmin.success.invitationCreated'), invitation });
});

export const listInvitationsHandler: RequestHandler = asyncHandler(async (req, res) => {
  const query = listInvitationsSchema.parse(req.query);
  res.status(200).json(await listInvitations(query));
});

export const revokeInvitationHandler: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = invitationIdParamsSchema.parse(req.params);
  const invitation = await revokeInvitation(id);
  res
    .status(200)
    .json({ message: req.t('superadmin.success.invitationRevoked'), invitation });
});
