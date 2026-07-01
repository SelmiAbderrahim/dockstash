// Dockstash web server — the public entrypoint.
// Serves server-rendered marketing pages (crawler/AI visible) and the CSR
// shell for the authenticated app. Plain ESM JS so it needs no build step.
//
// Dev:  Vite middlewareMode + ssrLoadModule (HMR).
// Prod: sirv static assets + imported dist/server/entry-server.js.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.WEB_PORT ?? process.env.PORT ?? 3000);

// Where the API serves /robots.txt + /sitemap*.xml (SEO module). The public
// origin must serve them, so we reverse-proxy those paths to the API.
const API_ORIGIN = (
  process.env.API_INTERNAL_URL ??
  (process.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api').replace(
    /\/api\/?$/,
    '',
  )
).replace(/\/$/, '');

// Authenticated app paths — always CSR shell, never SSR.
const APP_PREFIXES = [
  '/dashboard',
  '/profile',
  '/billing',
  '/checkout',
  '/admin',
  '/login',
  '/register',
  '/logout',
  '/forgot-password',
  '/reset-password',
];

const isAppPath = (pathname) =>
  APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** Assemble the final HTML from the template + SSR fragments. */
function renderHtml(template, { headTags = '', htmlAttrs = '', appHtml = '', ssr = false }) {
  let html = template;
  // Helmet emits per-page <title>/<meta name="description">; drop the
  // template's static fallbacks first so the document doesn't carry
  // duplicates (browsers and crawlers use the FIRST <title>, which would
  // otherwise always be the homepage one). Runs before headTags injection,
  // so these regexes can only match the template's own tags.
  if (headTags.includes('<title')) {
    html = html.replace(/<title>[^<]*<\/title>\s*/, '');
  }
  if (headTags.includes('name="description"')) {
    html = html.replace(/<meta\s+name="description"[\s\S]*?\/>\s*/, '');
  }
  return html
    .replace('<html lang="en">', `<html ${htmlAttrs || 'lang="en"'}>`)
    .replace('<!--ssr-head-->', headTags)
    .replace('<!--ssr-outlet-->', appHtml)
    .replace('<!--ssr-init-->', ssr ? '<script>window.__SSR__=true</script>' : '');
}

/** Proxy /robots.txt and /sitemap*.xml to the API's SEO module. */
async function proxySeo(req, res) {
  try {
    const upstream = await fetch(`${API_ORIGIN}${req.originalUrl}`, {
      headers: { accept: req.headers.accept ?? '*/*' },
    });
    res.status(upstream.status);
    const type = upstream.headers.get('content-type');
    if (type) res.set('content-type', type);
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.status(502).type('text/plain').send('SEO upstream unavailable');
  }
}

const SEO_PATHS = /^\/(robots\.txt|sitemap.*\.xml)$/;

async function createServer() {
  const app = express();
  app.disable('x-powered-by');

  app.get('/healthz', (_req, res) => res.type('text/plain').send('ok'));
  app.get(SEO_PATHS, proxySeo);

  let vite;
  let template;
  let render;

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
  } else {
    const compression = (await import('compression')).default;
    const sirv = (await import('sirv')).default;
    app.use(compression());
    app.use(
      '/assets',
      sirv(path.resolve(__dirname, 'dist/client/assets'), {
        immutable: true,
        maxAge: 60 * 60 * 24 * 30,
      }),
    );
    app.use(sirv(path.resolve(__dirname, 'dist/client'), { extensions: [] }));
    template = fs.readFileSync(
      path.resolve(__dirname, 'dist/client/index.html'),
      'utf-8',
    );
    render = (await import('./dist/server/entry-server.js')).render;
  }

  app.use('*', async (req, res, next) => {
    const url = req.originalUrl;
    const pathname = req.baseUrl || req.path || url.split('?')[0];

    try {
      let tpl;
      if (!isProd) {
        tpl = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        tpl = await vite.transformIndexHtml(url, tpl);
      } else {
        tpl = template;
      }

      // Authenticated app routes: serve the CSR shell (no SSR).
      if (isAppPath(pathname)) {
        return res
          .status(200)
          .set('Content-Type', 'text/html')
          .send(renderHtml(tpl, { ssr: false }));
      }

      const renderFn = isProd
        ? render
        : (await vite.ssrLoadModule('/src/entry-server.tsx')).render;

      const result = await renderFn(url);

      if (result.redirect) {
        return res.redirect(result.statusCode || 302, result.redirect);
      }

      // No marketing route matched → let the SPA handle it (CSR shell).
      if (result.statusCode === 404 || !result.appHtml) {
        return res
          .status(200)
          .set('Content-Type', 'text/html')
          .send(renderHtml(tpl, { ssr: false }));
      }

      return res
        .status(result.statusCode || 200)
        .set('Content-Type', 'text/html')
        .send(
          renderHtml(tpl, {
            headTags: result.headTags,
            htmlAttrs: result.htmlAttrs,
            appHtml: result.appHtml,
            ssr: true,
          }),
        );
    } catch (err) {
      if (vite) vite.ssrFixStacktrace(err);
      next(err);
    }
  });

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`web server listening on :${PORT} (${isProd ? 'prod' : 'dev'})`);
  });
}

createServer();
