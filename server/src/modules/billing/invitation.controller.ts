import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireUserId } from '../../shared/utils/require-user-id.js';
import { deliverInvitationClaimedEmail } from '../communication/index.js';
import { invitationTokenParamsSchema } from './invitation.schema.js';
import { claimInvitation, getPublicInvitation } from './invitation.service.js';

/** Public. Emits the sanitized `toPublicInvitation` shape for ANY status so the
 *  claim page can render a friendly dead-link state. */
export const resolveInvitation: RequestHandler = asyncHandler(async (req, res) => {
  const { token } = invitationTokenParamsSchema.parse(req.params);
  res.status(200).json(await getPublicInvitation(token));
});

/** Behind [requireAuth, requireVerified]. The operator notification fires only
 *  after the claim commits; `sendEmail` swallows transport failures, so a
 *  bounced notification can never fail the claim. */
export const claimInvitationHandler: RequestHandler = asyncHandler(async (req, res) => {
  const { token } = invitationTokenParamsSchema.parse(req.params);
  const result = await claimInvitation(requireUserId(req.user), token);
  await deliverInvitationClaimedEmail({
    claimantEmail: result.claimantEmail,
    claimantName: result.claimantName,
    plan: result.planSlug,
    grantDuration: result.grantDuration,
    claimedAt: result.claimedAt.toISOString(),
    currentPeriodEnd: result.currentPeriodEnd.toISOString(),
    label: result.label,
  });
  res.status(200).json({
    plan: result.planSlug,
    grantDuration: result.grantDuration,
    currentPeriodEnd: result.currentPeriodEnd.toISOString(),
  });
});
