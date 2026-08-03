import express, { type Express, Router } from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { passport } from './config/passport.js';
import { errorHandler } from './shared/middleware/error-handler.js';
import { notFound } from './shared/middleware/not-found.js';
import { requestId } from './shared/middleware/request-id.js';
import { language } from './shared/middleware/language.js';
import { securityHeaders } from './shared/middleware/security-headers.js';
import { apiNoStore } from './shared/middleware/no-store.js';
import {
  createAgentRateLimiter,
  createAuthRateLimiter,
  createContactRateLimiter,
} from './shared/middleware/rate-limit.js';
import { issueCsrfToken } from './shared/middleware/csrf.js';
import { authRouter, oauthPublicRouter, requireVerified } from './modules/auth/index.js';
import { requireAuth } from './shared/middleware/require-auth.js';
import { communicationRouter } from './modules/communication/index.js';
import { usersRouter } from './modules/users/index.js';
import { backupsRouter } from './modules/backups/index.js';
import { schedulerRouter } from './modules/scheduler/index.js';
import { auditRouter } from './modules/audit/index.js';
import {
  backupHealthRouter,
  healthRouter,
  projectHealthRouter,
} from './modules/health/index.js';
import { recoveryRouter } from './modules/recovery/index.js';
import { agentsRouter, agentApiRouter } from './modules/agents/index.js';
import { legalRouter } from './modules/legal/index.js';
import { settingsRouter } from './modules/settings/index.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestId);
  // Security headers (prompt 11). Applied early so every response — including
  // errors — carries them.
  app.use(securityHeaders);
  app.use(
    pinoHttp({
      logger,
      customProps: (req: express.Request) => ({ reqId: req.id }),
    }),
  );
  // Body parsers. Every surface is JSON; there is no raw-body route left to
  // register ahead of these, so the ordering here is unconditional.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  // CORS locked to CLIENT_URL only. No wildcard, no reflected origin —
  // enforced by rules/site-url-env-pattern.md in `rules/site-url-env-pattern.md`.
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(language);
  app.use(passport.initialize());

  // Every /api response is private, per-user JSON — never let a browser or proxy
  // cache it. Mounted before all /api routers so the CSRF token, health, and
  // every product surface inherit `Cache-Control: no-store`.
  app.use('/api', apiNoStore);

  // CSRF token endpoint (double-submit). Cookie-authenticated surfaces call
  // this before any mutating request. Bearer-token API calls are exempt from
  // CSRF — see docs/security-model.en.md.
  const securityRouter = Router();
  securityRouter.get('/csrf-token', issueCsrfToken);
  app.use('/api/security', securityRouter);

  app.use('/api', healthRouter);
  // Product surfaces are hard-gated behind [requireAuth, requireVerified] —
  // defined below and reused here so an authenticated-but-unverified session
  // cannot silently reach /api/health/{projects,overview,alerts}. Only the
  // public liveness/metrics under `healthRouter` above stay unauthenticated.
  // See S1-01 in prompts/dockstash-security/findings.md.
  const verified = [requireAuth, requireVerified];
  app.use('/api/health/projects', verified, projectHealthRouter);
  // Backup-health dashboard + alert center (mounted after the legacy projects
  // list so `GET /api/health/projects` keeps its handler; see health.routes).
  app.use('/api/health', verified, backupHealthRouter);
  // OAuth capability probe mounted BEFORE the rate limiter: the client asks
  // it on every login/register render, and inside the 10-req/15-min auth
  // budget it would starve real login attempts. Read-only, leaks nothing.
  app.use('/api/auth', oauthPublicRouter);
  // Auth routes are rate-limited: sustained cracking attempts hit 429 well
  // before they can enumerate accounts. The limiter is idempotent across
  // hot-reload restarts.
  app.use('/api/auth', createAuthRateLimiter(), authRouter);
  // GDPR export/deletion stays reachable even for unverified accounts (data
  // rights must not be gated); health/security are public above.
  app.use('/api/legal', legalRouter);
  // Contact form is unauthenticated and sends a real email per request — throttle
  // it to prevent mail-bombing / provider-quota abuse.
  app.use('/api/communication', createContactRateLimiter(), communicationRouter);
  // Fleet-agent machine surface: daemons self-authenticate with their
  // composite Bearer token (require-agent-auth) — no JWT, no email gate.
  // Distinct prefix from the user-facing /api/agents router below.
  app.use('/api/agent', createAgentRateLimiter(), agentApiRouter);

  // Product surfaces are hard-gated: an authenticated but unverified user is
  // blocked (403 EMAIL_NOT_VERIFIED) until they confirm their email. `requireAuth`
  // populates req.user so `requireVerified` can do its DB check. The `verified`
  // array is declared above the health mount so the same gate applies uniformly.
  app.use('/api/audit', verified, auditRouter);
  app.use('/api/users', verified, usersRouter);
  app.use('/api/backups', verified, backupsRouter);
  app.use('/api/scheduler', verified, schedulerRouter);
  app.use('/api/recovery', verified, recoveryRouter);
  app.use('/api/agents', verified, agentsRouter);
  app.use('/api/settings', verified, settingsRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
