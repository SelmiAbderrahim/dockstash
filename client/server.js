// Dockstash web server — the public entrypoint.
// Serves the built single-page app: hashed assets from dist/, and index.html
// for every other path (history fallback). Plain ESM JS so it needs no build
// step. `npm run dev` uses Vite directly; this file only serves a build.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';

// SHA-256 hash of the theme no-flash bootstrap inlined in index.html — the
// only inline script the app ships. Recompute if the script body changes;
// kept in sync with server/src/shared/middleware/security-headers.ts
// CSP_INLINE_THEME_HASH.
const CSP_INLINE_THEME_HASH = 'sha256-Ai8enj3xMBb6rfnOEbqcZWXXLQ+hKVptkKTEKAJ0z/o=';
const CSP_DIRECTIVES = {
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.WEB_PORT ?? process.env.PORT ?? 3000);
const DIST = path.resolve(__dirname, 'dist');

async function createServer() {
  const app = express();
  app.disable('x-powered-by');
  // SEC-11: helmet CSP for the web surface. Enforced (not report-only).
  app.use(
    helmet({
      contentSecurityPolicy: { useDefaults: false, directives: CSP_DIRECTIVES },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  // Registered before compression so container probes stay untouched.
  app.get('/healthz', (_req, res) => res.type('text/plain').send('ok'));

  if (isProd) {
    const compression = (await import('compression')).default;
    app.use(compression());
  }

  const sirv = (await import('sirv')).default;
  // Vite emits content-hashed filenames under /assets — safe to cache hard.
  app.use(
    '/assets',
    sirv(path.join(DIST, 'assets'), {
      immutable: true,
      maxAge: 60 * 60 * 24 * 30,
    }),
  );
  app.use(sirv(DIST, { extensions: [] }));

  // History fallback: every unmatched path is an app route. The shell is
  // auth-adjacent — never let intermediaries cache it.
  const template = fs.readFileSync(path.join(DIST, 'index.html'), 'utf-8');
  app.use('*', (_req, res) =>
    res
      .status(200)
      .set('Content-Type', 'text/html')
      .set('Cache-Control', 'no-store')
      .send(template),
  );

  app.listen(PORT, () => {

    console.log(`web server listening on :${PORT} (${isProd ? 'prod' : 'dev'})`);
  });
}

createServer();
