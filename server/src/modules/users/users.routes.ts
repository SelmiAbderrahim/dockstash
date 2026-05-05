import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { viewProfile } from './users.controller.js';

export const usersRouter: Router = Router();

usersRouter.get('/:userId', requireAuth, viewProfile);
