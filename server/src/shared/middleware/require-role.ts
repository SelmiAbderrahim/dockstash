import type { RequestHandler } from 'express';
import { HttpError } from '../utils/http-error.js';
import { getRoleRank, type Role } from '../../modules/users/index.js';

/**
 * Rank-based role gate. Runs after `requireAuth` (which populates `req.user`
 * from the DB, so role demotions apply immediately). An unknown/missing role
 * ranks 0 and is always rejected.
 */
export function requireRole(minRole: Role): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(HttpError.unauthorized('errors.unauthorized'));
      return;
    }
    if (getRoleRank(req.user.role) < getRoleRank(minRole)) {
      next(HttpError.forbidden('errors.forbidden'));
      return;
    }
    next();
  };
}
