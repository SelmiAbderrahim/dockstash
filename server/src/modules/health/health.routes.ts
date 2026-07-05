import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import {
  alerts,
  health,
  markRead,
  metrics,
  overview,
  projectHealth,
  projectHealthDetail,
} from './health.controller.js';

/**
 * `/health` — unauthenticated liveness/readiness for external uptime monitoring.
 * `/metrics` — unauthenticated aggregate counters (no PII).
 */
export const healthRouter: Router = Router();
healthRouter.get('/health', health);
healthRouter.get('/metrics', metrics);

/** Owner-scoped per-project health, mounted under `/api/health/projects`. */
export const projectHealthRouter: Router = Router();
projectHealthRouter.use(requireAuth);
projectHealthRouter.get('/', projectHealth);

/**
 * Backup-health dashboard + alert center, mounted under `/api/health` AFTER
 * `projectHealthRouter` — `GET /api/health/projects` (list) keeps its legacy
 * handler while `/projects/:projectId` falls through to the detail here.
 */
export const backupHealthRouter: Router = Router();
backupHealthRouter.use(requireAuth);
backupHealthRouter.get('/overview', overview);
backupHealthRouter.get('/projects/:projectId', projectHealthDetail);
backupHealthRouter.get('/alerts', alerts);
backupHealthRouter.post('/alerts/read', markRead);
