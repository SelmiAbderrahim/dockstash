import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { HttpError } from '../../shared/utils/http-error.js';
import { userIdParamsSchema } from './users.schema.js';
import { getUserProfile } from './users.service.js';

export const viewProfile: RequestHandler = asyncHandler(async (req, res) => {
  const { userId } = userIdParamsSchema.parse(req.params);
  if (!req.user || req.user.id !== userId) {
    throw HttpError.unauthorized('errors.forbidden');
  }
  const user = await getUserProfile(userId);
  res.status(200).json({ user });
});
