import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http-error.js';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    logger.warn({ reqId: req.id, status: err.status, msg: err.message }, 'http error');
    res.status(err.status).json({
      error: { message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: { message: 'Validation failed', details: err.flatten() },
    });
    return;
  }

  logger.error({ reqId: req.id, err }, 'unhandled error');
  res.status(500).json({
    error: {
      message: 'Internal Server Error',
      ...(env.NODE_ENV === 'development' && err instanceof Error
        ? { stack: err.stack }
        : {}),
    },
  });
};
