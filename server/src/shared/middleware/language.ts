import type { RequestHandler } from 'express';
import {
  LANGUAGE_COOKIE,
  LANGUAGE_HEADER,
  resolveLanguage,
  translate,
  type TranslationVars,
} from '../i18n/index.js';
import { env } from '../../config/env.js';

function readLanguageCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawName, ...rest] = part.split('=');
    const name = (rawName ?? '').trim();
    if (name === LANGUAGE_COOKIE) {
      const raw = rest.join('=').trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
}

export const language: RequestHandler = (req, _res, next) => {
  const headerOverride = req.headers[LANGUAGE_HEADER];
  const override = Array.isArray(headerOverride) ? headerOverride[0] : headerOverride;
  const cookieValue = readLanguageCookie(req.headers.cookie);
  const acceptLanguage = req.headers['accept-language'];

  const resolved = resolveLanguage({
    override,
    cookieValue,
    acceptLanguage: Array.isArray(acceptLanguage) ? acceptLanguage[0] : acceptLanguage,
    defaultLocale: env.DEFAULT_LOCALE,
  });

  req.language = resolved;
  req.t = (key: string, vars?: TranslationVars) => translate(resolved, key, vars);
  next();
};
