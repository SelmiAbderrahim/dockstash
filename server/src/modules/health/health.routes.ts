import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { health, metrics, projectHealth } from './health.controller.js';

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
