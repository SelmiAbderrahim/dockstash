import type { RequestHandler } from 'express';
import passport from 'passport';
import { HttpError } from '../utils/http-error.js';

export const requireAuth: RequestHandler = (req, res, next) => {
  passport.authenticate(
    'jwt',
    { session: false },
    (err: unknown, user: Express.Request['user'] | false) => {
      if (err) {
        next(err);
        return;
      }
      if (!user) {
        next(HttpError.unauthorized('errors.unauthorized'));
        return;
      }
      req.user = user;
      next();
    },
  )(req, res, next);
};
