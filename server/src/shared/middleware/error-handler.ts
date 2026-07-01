import type { ErrorRequestHandler, Request } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http-error.js';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';
import { DEFAULT_LOCALE, translate, DICTIONARIES } from '../i18n/index.js';

const KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;

function looksLikeI18nKey(message: string): boolean {
  return KEY_PATTERN.test(message);
}

function hasKey(key: string): boolean {
  const segments = key.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursor: any = DICTIONARIES[DEFAULT_LOCALE];
  for (const segment of segments) {
    if (cursor == null || typeof cursor !== 'object') return false;
    cursor = cursor[segment];
  }
  return typeof cursor === 'string';
}

function translateMessage(req: Request, message: string): string {
  if (!looksLikeI18nKey(message)) return message;
  if (!hasKey(message)) return message;
  const t = req.t;
  if (typeof t === 'function') return t(message);
  return translate(req.language ?? DEFAULT_LOCALE, message);
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    const message = translateMessage(req, err.message);
    logger.warn({ reqId: req.id, status: err.status, msg: message }, 'http error');
    res.status(err.status).json({
      error: { message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        message: translateMessage(req, 'errors.validationFailed'),
        details: err.flatten(),
      },
    });
    return;
  }

  logger.error({ reqId: req.id, err }, 'unhandled error');
  res.status(500).json({
    error: {
      message: translateMessage(req, 'errors.internal'),
      ...(env.NODE_ENV === 'development' && err instanceof Error
        ? { stack: err.stack }
        : {}),
    },
  });
};
