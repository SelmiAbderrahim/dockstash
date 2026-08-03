import type { RequestHandler } from 'express';
import helmet from 'helmet';

// SHA-256 hash of the only inline script the app ships: the theme no-flash
// bootstrap in client/index.html. Recompute if the script body changes — the
// same constant is mirrored in client/server.js.
export const CSP_INLINE_THEME_HASH = 'sha256-Ai8enj3xMBb6rfnOEbqcZWXXLQ+hKVptkKTEKAJ0z/o=';

// Starter CSP (Phase 06 SEC-11). Shared by the web surface and the API.
// `style-src 'unsafe-inline'` is a pragmatic starter for React inline styles —
// tightening to hashes/nonces is a documented follow-up. Everything else stays
// same-origin; third-party origins go into the specific directive, never as a
// wildcard.
export const CSP_DIRECTIVES: Record<string, string[]> = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", `'${CSP_INLINE_THEME_HASH}'`],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:'],
  fontSrc: ["'self'", 'data:'],
  connectSrc: ["'self'"],
  objectSrc: ["'none'"],
  frameAncestors: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
};

// Helmet with defaults tightened for a JSON API + static SPA surface.
export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: CSP_DIRECTIVES,
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
});
