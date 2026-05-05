import express, { type Express } from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { passport } from './config/passport.js';
import { errorHandler } from './shared/middleware/error-handler.js';
import { notFound } from './shared/middleware/not-found.js';
import { requestId } from './shared/middleware/request-id.js';
import { authRouter, protectedRouter } from './modules/auth/index.js';
import { billingRouter } from './modules/billing/index.js';
import { chatRouter } from './modules/chat/index.js';
import { communicationRouter } from './modules/communication/index.js';
import { usersRouter } from './modules/users/index.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      customProps: (req: express.Request) => ({ reqId: req.id }),
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(passport.initialize());

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/communication', communicationRouter);
  app.use('/api/billing', billingRouter);
  app.use('/api', protectedRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
