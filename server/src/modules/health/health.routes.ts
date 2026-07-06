import { Router } from 'express';
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

/**
 * Owner-scoped per-project health, mounted under `/api/health/projects`.
 * Auth + verified gate applied at the mount site in `createApp()` — mirrors
 * every other product router so an authenticated-but-unverified session cannot
 * silently probe /api/health/{projects,overview,alerts}. See S1-01 in
 * `prompts/dockstash-security/findings.md`.
 */
export const projectHealthRouter: Router = Router();
projectHealthRouter.get('/', projectHealth);

/**
 * Backup-health dashboard + alert center, mounted under `/api/health` AFTER
 * `projectHealthRouter` — `GET /api/health/projects` (list) keeps its legacy
 * handler while `/projects/:projectId` falls through to the detail here. Auth
 * + verified gate applied at the mount site (see projectHealthRouter above).
 */
export const backupHealthRouter: Router = Router();
backupHealthRouter.get('/overview', overview);
backupHealthRouter.get('/projects/:projectId', projectHealthDetail);
backupHealthRouter.get('/alerts', alerts);
backupHealthRouter.post('/alerts/read', markRead);
