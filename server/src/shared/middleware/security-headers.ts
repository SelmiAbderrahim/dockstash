import type { RequestHandler } from 'express';
import helmet from 'helmet';

// SHA-256 hashes of the two inline scripts served by client/server.js:
//   - the theme no-flash bootstrap (client/index.html, ~lines 19–33)
//   - `window.__SSR__=true` (injected by renderHtml at client/server.js:62)
// Recompute both if the script bodies change — see client/server.js for the
// exact strings covered.
export const CSP_INLINE_THEME_HASH = 'sha256-Ai8enj3xMBb6rfnOEbqcZWXXLQ+hKVptkKTEKAJ0z/o=';
export const CSP_INLINE_SSR_MARKER_HASH = 'sha256-H4IPIqVUyi3ISZIAtVbaGRIonXX8D9ffDFVol7IUAGo=';

// Starter CSP (Phase 06 SEC-11). Shared by the SSR web surface and the API.
// `style-src 'unsafe-inline'` is a pragmatic starter for React inline styles —
// tightening to hashes/nonces is a documented follow-up. Everything else stays
// same-origin; third-party origins go into the specific directive, never as a
// wildcard.
export const CSP_DIRECTIVES: Record<string, string[]> = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", `'${CSP_INLINE_THEME_HASH}'`, `'${CSP_INLINE_SSR_MARKER_HASH}'`],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:'],
  fontSrc: ["'self'", 'data:'],
  connectSrc: ["'self'"],
  objectSrc: ["'none'"],
  frameAncestors: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
};

// Helmet with defaults tightened for a JSON API + SSR marketing surface.
export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: CSP_DIRECTIVES,
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
});
