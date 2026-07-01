import type { RequestHandler } from 'express';
import helmet from 'helmet';

// Helmet with defaults tightened for a JSON API + SSR marketing surface.
// CSP is left to the web (SSR) container; the api sets the standard headers
// that never conflict with restic/dockerode payloads.
export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
});
