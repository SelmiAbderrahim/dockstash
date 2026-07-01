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
import { createAuthRateLimiter, createWebhookRateLimiter } from './shared/middleware/rate-limit.js';
import { issueCsrfToken } from './shared/middleware/csrf.js';
import { authRouter, protectedRouter } from './modules/auth/index.js';
import { billingRouter, webhookHandler } from './modules/billing/index.js';
import { communicationRouter } from './modules/communication/index.js';
import { usersRouter } from './modules/users/index.js';
import { backupsRouter } from './modules/backups/index.js';
import { schedulerRouter } from './modules/scheduler/index.js';
import { auditRouter } from './modules/audit/index.js';
import { healthRouter, projectHealthRouter } from './modules/health/index.js';
import { seoRouter } from './modules/seo/index.js';
import { recoveryRouter } from './modules/recovery/index.js';
import { legalRouter } from './modules/legal/index.js';

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
  app.use('/api/audit', auditRouter);
  // Auth routes are rate-limited: sustained cracking attempts hit 429 well
  // before they can enumerate accounts. The limiter is idempotent across
  // hot-reload restarts.
  app.use('/api/auth', createAuthRateLimiter(), authRouter);
  app.use('/api/legal', legalRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/communication', communicationRouter);
  app.use('/api/billing', billingRouter);
  app.use('/api/backups', backupsRouter);
  app.use('/api/scheduler', schedulerRouter);
  app.use('/api/recovery', recoveryRouter);
  app.use('/api', protectedRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
