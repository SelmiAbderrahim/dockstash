import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { updatePreferences, updateProfile, viewProfile } from './users.controller.js';

export const usersRouter: Router = Router();

usersRouter.get('/:userId', requireAuth, viewProfile);
usersRouter.patch('/:userId', requireAuth, updateProfile);
usersRouter.patch('/:userId/preferences', requireAuth, updatePreferences);
