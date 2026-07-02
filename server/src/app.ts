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
  createWebhookRateLimiter,
} from './shared/middleware/rate-limit.js';
import { issueCsrfToken } from './shared/middleware/csrf.js';
import { authRouter, requireVerified } from './modules/auth/index.js';
import { requireAuth } from './shared/middleware/require-auth.js';
import { billingRouter, billingPublicRouter, webhookHandler } from './modules/billing/index.js';
import { communicationRouter } from './modules/communication/index.js';
import { usersRouter } from './modules/users/index.js';
import { backupsRouter } from './modules/backups/index.js';
import { schedulerRouter } from './modules/scheduler/index.js';
import { auditRouter } from './modules/audit/index.js';
import { healthRouter, projectHealthRouter } from './modules/health/index.js';
import { seoRouter } from './modules/seo/index.js';
import { recoveryRouter } from './modules/recovery/index.js';
import { agentsRouter, agentApiRouter } from './modules/agents/index.js';
import { legalRouter } from './modules/legal/index.js';
import { settingsRouter } from './modules/settings/index.js';
import { superadminRouter } from './modules/superadmin/index.js';
import { requireRole } from './shared/middleware/require-role.js';
import { ROLE_SUPERADMIN } from './modules/users/index.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestId);
  // Security headers (prompt 11). Applied early so every response — even
  // errors from the raw-body webhook route below — carries them.
  app.use(securityHeaders);
  app.use(
    pinoHttp({
      logger,
      customProps: (req: express.Request) => ({ reqId: req.id }),
    }),
  );
  // Billing webhook MUST receive the raw request body for HMAC verification.
  // The rate limiter runs BEFORE `express.raw` so a flood cannot burn signature
  // math, and NEVER consumes the request body. Registered BEFORE the global
  // JSON parser so the ingest pipeline sees the unparsed Buffer. See
  // modules/billing/webhook/verify.
  app.post(
    '/api/billing/webhook',
    createWebhookRateLimiter(),
    express.raw({ type: '*/*', limit: '1mb' }),
    webhookHandler,
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  // CORS locked to CLIENT_URL only. No wildcard, no reflected origin —
  // enforced by rules/site-url-env-pattern.md and IDEA.md §1.
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(language);
  app.use(passport.initialize());

  // Every /api response is private, per-user JSON — never let a browser or proxy
  // cache it. Mounted before all /api routers so the CSRF token, health, and
  // every product surface inherit `Cache-Control: no-store`. The SEO router is
  // mounted at `/` (not `/api`) below and keeps its own cacheable headers.
  app.use('/api', apiNoStore);

  // CSRF token endpoint (double-submit). Cookie-authenticated surfaces call
  // this before any mutating request. Bearer-token API calls are exempt from
  // CSRF — see docs/security-model.en.md.
  const securityRouter = Router();
  securityRouter.get('/csrf-token', issueCsrfToken);
  app.use('/api/security', securityRouter);

  // SEO endpoints (robots.txt, sitemaps) — top-level, public, no auth. Mounted
  // before the /api routers and before notFound so they resolve first.
  app.use('/', seoRouter);

  app.use('/api', healthRouter);
  app.use('/api/health/projects', projectHealthRouter);
  // Auth routes are rate-limited: sustained cracking attempts hit 429 well
  // before they can enumerate accounts. The limiter is idempotent across
  // hot-reload restarts.
  app.use('/api/auth', createAuthRateLimiter(), authRouter);
  // GDPR export/deletion stays reachable even for unverified accounts (data
  // rights must not be gated); health/seo/security are public above.
  app.use('/api/legal', legalRouter);
  app.use('/api/communication', communicationRouter);
  // Fleet-agent machine surface: daemons self-authenticate with their
  // composite Bearer token (require-agent-auth) — no JWT, no email gate.
  // Distinct prefix from the user-facing /api/agents router below.
  app.use('/api/agent', createAgentRateLimiter(), agentApiRouter);

  // Product surfaces are hard-gated: an authenticated but unverified user is
  // blocked (403 EMAIL_NOT_VERIFIED) until they confirm their email. `requireAuth`
  // populates req.user so `requireVerified` can do its DB check.
  const verified = [requireAuth, requireVerified];
  app.use('/api/audit', verified, auditRouter);
  app.use('/api/users', verified, usersRouter);
  // Public pricing catalog is mounted BEFORE the `verified` gate; Express matches
  // routers in order so `GET /api/billing/pricing-tiers` resolves here and never
  // reaches `requireAuth`. All other billing surfaces stay gated below.
  app.use('/api/billing', billingPublicRouter);
  app.use('/api/billing', verified, billingRouter);
  app.use('/api/backups', verified, backupsRouter);
  app.use('/api/scheduler', verified, schedulerRouter);
  app.use('/api/recovery', verified, recoveryRouter);
  app.use('/api/agents', verified, agentsRouter);
  app.use('/api/settings', verified, settingsRouter);
  // Superadmin console — the seeder creates the account verified, so the
  // uniform requireVerified product gate applies here too.
  app.use('/api/superadmin', verified, requireRole(ROLE_SUPERADMIN), superadminRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
