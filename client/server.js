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
import { APP_PREFIXES } from './app-paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.WEB_PORT ?? process.env.PORT ?? 3000);

// Canonical public origin (e.g. https://dockstash.com) — drives the www→apex
// redirect. Empty in environments without VITE_SITE_URL (no redirect then).
const SITE_ORIGIN = (process.env.VITE_SITE_URL ?? '').replace(/\/+$/, '');
const CANONICAL_HOST = SITE_ORIGIN ? new URL(SITE_ORIGIN).host : '';

// Where the API serves /robots.txt + /sitemap*.xml (SEO module). The public
// origin must serve them, so we reverse-proxy those paths to the API.
const API_ORIGIN = (
  process.env.API_INTERNAL_URL ??
  (process.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api').replace(
    /\/api\/?$/,
    '',
  )
).replace(/\/$/, '');

// Authenticated app paths — always CSR shell, never SSR (see app-paths.mjs).
const isAppPath = (pathname) =>
  APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * Assemble the final HTML from the template + SSR fragments.
 *
 * Deliberately no template-level `<meta name="robots">`: a global noindex
 * would win (most-restrictive) over per-page robots tags on SSR'd marketing
 * pages. CSR-only pages handle their own robots meta client-side and are
 * Disallow'd in robots.txt anyway.
 */
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

/** Proxy /robots.txt, /sitemap*.xml and /llms.txt to the API's SEO module. */
async function proxySeo(req, res) {
  try {
    const upstream = await fetch(`${API_ORIGIN}${req.originalUrl}`, {
      headers: { accept: req.headers.accept ?? '*/*' },
    });
    res.status(upstream.status);
    for (const header of ['content-type', 'cache-control']) {
      const value = upstream.headers.get(header);
      if (value) res.set(header, value);
    }
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.status(502).type('text/plain').send('SEO upstream unavailable');
  }
}

const SEO_PATHS = /^\/(robots\.txt|sitemap[\w-]*\.xml|llms\.txt)$/;

/**
 * One canonical form per URL: www → apex and no trailing slashes. HTTPS
 * redirects are nginx's job (TLS terminates there; this server binds loopback).
 */
function canonicalRedirects(req, res, next) {
  // Only the exact www.<canonical> host redirects — generic host mismatches
  // pass through so localhost and docker-internal probes keep working.
  if (CANONICAL_HOST && req.headers.host === `www.${CANONICAL_HOST}`) {
    return res.redirect(301, `${SITE_ORIGIN}${req.originalUrl}`);
  }
  if (req.path.length > 1 && req.path.endsWith('/')) {
    const query = req.originalUrl.slice(req.path.length);
    return res.redirect(301, req.path.replace(/\/+$/, '') + query);
  }
  return next();
}

async function createServer() {
  const app = express();
  app.disable('x-powered-by');

  app.get('/healthz', (_req, res) => res.type('text/plain').send('ok'));

  // Compression must be registered before the SEO proxy so robots/sitemaps
  // are gzipped too, and after /healthz so probes stay untouched.
  if (isProd) {
    const compression = (await import('compression')).default;
    app.use(compression());
  }

  app.use(canonicalRedirects);
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
    const sirv = (await import('sirv')).default;
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

      // Authenticated app routes: serve the CSR shell (no SSR). The shell is
      // auth-adjacent — never let intermediaries cache it.
      if (isAppPath(pathname)) {
        return res
          .status(200)
          .set('Content-Type', 'text/html')
          .set('Cache-Control', 'no-store')
          .send(renderHtml(tpl, { ssr: false }));
      }

      const renderFn = isProd
        ? render
        : (await vite.ssrLoadModule('/src/entry-server.tsx')).render;

      const result = await renderFn(url);

      if (result.redirect) {
        return res.redirect(result.statusCode || 302, result.redirect);
      }

      // Defensive fallback: the marketing splat route guarantees appHtml for
      // every non-app path (unknown URLs SSR the 404 page with a real 404
      // status), so an empty render means something went wrong — serve the
      // CSR shell rather than a blank page.
      if (!result.appHtml) {
        return res
          .status(200)
          .set('Content-Type', 'text/html')
          .set('Cache-Control', 'no-store')
          .send(renderHtml(tpl, { ssr: false }));
      }

      const statusCode = result.statusCode || 200;
      return res
        .status(statusCode)
        .set('Content-Type', 'text/html')
        .set(
          'Cache-Control',
          statusCode === 200
            ? 'public, max-age=300, stale-while-revalidate=3600'
            : 'no-store',
        )
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
     
    console.log(`web server listening on :${PORT} (${isProd ? 'prod' : 'dev'})`);
  });
}

createServer();
