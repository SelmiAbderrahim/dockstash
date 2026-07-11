import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireVerified } from '../auth/index.js';
import { claimInvitationHandler, resolveInvitation } from './invitation.controller.js';

/**
 * Mounted at `/api/invitations` in app.ts. `GET /:token` is the ONE
 * unauthenticated endpoint of this feature — it returns the sanitized offer
 * summary only. The claim sits behind [requireAuth, requireVerified].
 */
export const invitationRouter: Router = Router();

invitationRouter.get('/:token', resolveInvitation);
invitationRouter.post('/:token/claim', requireAuth, requireVerified, claimInvitationHandler);
