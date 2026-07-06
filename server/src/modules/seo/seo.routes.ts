import { Router, type RequestHandler } from 'express';
import { env } from '../../config/env.js';
import {
  ALLOWED_CRAWLERS,
  ALTERNATIVE_PATHS,
  buildUrlEntry,
  COMPETITOR_SLUGS,
  CORE_PATHS,
  DISALLOWED_PATHS,
  GUIDE_PATHS,
  GUIDE_SLUGS,
  isTranslatedPath,
  PLATFORM_GUIDE_PATHS,
  PLATFORM_GUIDE_SLUGS,
  PLATFORM_GUIDE_TITLES,
  SEO_LASTMOD,
  USECASE_PATHS,
  USECASE_SLUGS,
} from './seo.data.js';

/**
 * Canonical public origin for absolute URLs. `CLIENT_URL` is the public web
 * origin (the SPA / marketing site) — SEO URLs must point there, not at the API.
 */
function publicOrigin(): string {
  return env.CLIENT_URL.replace(/\/$/, '');
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

const CHILD_SITEMAPS = [
  '/sitemap-core.xml',
  '/sitemap-alternatives.xml',
  '/sitemap-guides.xml',
  '/sitemap-usecases.xml',
] as const;

function renderRobots(origin: string): string {
  const lines: string[] = [];
  for (const agent of ALLOWED_CRAWLERS) {
    lines.push(`User-agent: ${agent}`);
    lines.push('Allow: /');
    lines.push('');
  }
  lines.push('User-agent: *');
  for (const path of DISALLOWED_PATHS) {
    lines.push(`Disallow: ${path}`);
  }
  lines.push('Allow: /');
  lines.push('');
  lines.push(`Sitemap: ${origin}/sitemap.xml`);
  lines.push('');
  return lines.join('\n');
}

function renderSitemapIndex(origin: string): string {
  const entries = CHILD_SITEMAPS.map((path) =>
    ['  <sitemap>', `    <loc>${origin}${path}</loc>`, `    <lastmod>${SEO_LASTMOD}</lastmod>`, '  </sitemap>'].join(
      '\n',
    ),
  );
  return [
    XML_HEADER,
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</sitemapindex>',
    '',
  ].join('\n');
}

function renderUrlset(origin: string, paths: readonly string[]): string {
  // hreflang alternates are only advertised for pages that are actually
  // translated per locale: the translated core paths and the whole /guides
  // surface (hub + service + platform articles ship localized copy bundles).
  // Alternatives/vs and use-cases stay programmatic English and emit plain
  // <loc> + <lastmod> entries.
  const entries = paths.map((path) =>
    buildUrlEntry(origin, path, SEO_LASTMOD, isTranslatedPath(path)),
  );
  return [
    XML_HEADER,
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');
}

/** "restic-cron-scripts" → "Restic cron scripts". */
function humanizeSlug(slug: string): string {
  const words = slug.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * llms.txt — a markdown site manifest for AI crawlers/assistants
 * (https://llmstxt.org). Mirrors the sitemap inventory with human titles so
 * LLMs can navigate and cite the marketing surface without rendering JS.
 */
export function renderLlmsTxt(origin: string): string {
  const lines: string[] = [
    '# Dockstash',
    '',
    '> Dockstash makes backing up any Docker project one click — automatic detection, encrypted off-site Restic snapshots, and one-click restore.',
    '',
    'Dockstash is a Docker-aware backup orchestrator: it auto-detects volumes, databases and config, dumps databases consistently (pg_dumpall, mysqldump --single-transaction, mongodump --oplog), and stores encrypted Restic snapshots off-site with automated restore-drill verification.',
    '',
    '## Product',
    `- [Home](${origin}/): What Dockstash does and how verified Docker backups work`,
    `- [Pricing](${origin}/pricing): Plans, including the free self-host tier`,
    `- [Fleet agents](${origin}/fleet-agents): Back up every VPS from one dashboard with lightweight outbound-only agents`,
    `- [Continuous backup](${origin}/continuous-backup): Near-continuous snapshots every five minutes with point-in-time restore`,
    `- [Backup monitoring](${origin}/backup-monitoring): Health dashboard, alert center, email and webhook alerts for every project`,
    `- [Mirror mode](${origin}/mirror): Scheduled one-way directory replication through the encrypted restic repo`,
    `- [Security](${origin}/security): Security model, encryption, and restore verification`,
    `- [FAQ](${origin}/faq): Common questions about backing up Docker projects`,
    '',
    '## Guides',
  ];
  for (const slug of GUIDE_SLUGS) {
    lines.push(
      `- [Back up ${humanizeSlug(slug)} in Docker](${origin}/guides/backup-${slug}-docker)`,
    );
  }
  lines.push('', '## Platform guides');
  for (const [slug, title] of Object.entries(PLATFORM_GUIDE_TITLES)) {
    lines.push(`- [${title}](${origin}/guides/${slug})`);
  }
  lines.push('', '## Backup targets');
  for (const slug of USECASE_SLUGS) {
    lines.push(
      `- [Back up ${humanizeSlug(slug)} running in Docker](${origin}/backup/${slug}-docker)`,
    );
  }
  lines.push('', '## Comparisons');
  lines.push(`- [Dockstash alternatives](${origin}/alternatives)`);
  for (const slug of COMPETITOR_SLUGS) {
    lines.push(`- [${humanizeSlug(slug)} alternative](${origin}/alternatives/${slug})`);
    lines.push(`- [Dockstash vs ${humanizeSlug(slug)}](${origin}/vs/${slug})`);
  }
  lines.push(
    `- [Self-hosted backup vs cloud backup](${origin}/compare/self-hosted-backup-vs-cloud-backup)`,
  );
  lines.push('', '## Legal');
  lines.push(`- [Privacy policy](${origin}/privacy)`);
  lines.push(`- [Terms of service](${origin}/terms)`);
  lines.push('');
  return lines.join('\n');
}

const robotsHandler: RequestHandler = (_req, res) => {
  res.type('text/plain').send(renderRobots(publicOrigin()));
};

const llmsHandler: RequestHandler = (_req, res) => {
  res.type('text/plain; charset=utf-8').send(renderLlmsTxt(publicOrigin()));
};

const sitemapIndexHandler: RequestHandler = (_req, res) => {
  res.type('application/xml').send(renderSitemapIndex(publicOrigin()));
};

function urlsetHandler(paths: readonly string[]): RequestHandler {
  return (_req, res) => {
    res.type('application/xml').send(renderUrlset(publicOrigin(), paths));
  };
}

export const seoRouter: Router = Router();

// Content is deterministic per deploy — safe for shared caches to hold for an
// hour and revalidate lazily. This header MUST be scoped to the actual SEO
// responses: the router is mounted at `/`, so a blanket `.use()` would set it
// on every fall-through request (including `/api/*`) and mark private API JSON
// publicly cacheable. `cacheable()` applies it per-handler instead.
const cacheable =
  (handler: RequestHandler): RequestHandler =>
  (req, res, next) => {
    res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    handler(req, res, next);
  };

seoRouter.get('/robots.txt', cacheable(robotsHandler));
seoRouter.get('/llms.txt', cacheable(llmsHandler));
seoRouter.get('/sitemap.xml', cacheable(sitemapIndexHandler));
seoRouter.get('/sitemap-core.xml', cacheable(urlsetHandler(CORE_PATHS)));
seoRouter.get('/sitemap-alternatives.xml', cacheable(urlsetHandler(ALTERNATIVE_PATHS)));
seoRouter.get(
  '/sitemap-guides.xml',
  cacheable(urlsetHandler([...GUIDE_PATHS, ...PLATFORM_GUIDE_PATHS])),
);
seoRouter.get('/sitemap-usecases.xml', cacheable(urlsetHandler(USECASE_PATHS)));
