// SEO URL inventory for robots.txt / sitemap generation.
//
// Mirrors client/src/features/marketing/content/*. Keep slugs in sync.
//
// `en` is the x-default locale and is served on the un-prefixed path. Every
// other locale is served under a `/<locale>` path prefix.

export const LOCALES = ['en', 'ar', 'fr', 'de', 'es', 'ru', 'zh'] as const;

export type SeoLocale = (typeof LOCALES)[number];

/** The locale served on un-prefixed paths (also the hreflang x-default). */
export const DEFAULT_LOCALE: SeoLocale = 'en';

/** Core marketing/product pages. */
export const CORE_PATHS: readonly string[] = [
  '/',
  '/pricing',
  '/alternatives',
  '/guides',
  '/security',
  '/faq',
  '/compare/self-hosted-backup-vs-cloud-backup',
];

/** Competitor "alternative" / "vs" pages. */
export const ALTERNATIVE_PATHS: readonly string[] = [
  '/alternatives/backrest',
  '/vs/backrest',
  '/alternatives/simplebackups',
  '/alternatives/duplicati',
  '/alternatives/restic-cron-scripts',
];

/** Database backup guide slugs → `/guides/backup-<slug>-docker`. */
export const GUIDE_SLUGS: readonly string[] = [
  'postgres',
  'mysql',
  'mariadb',
  'mongodb',
  'redis',
  'valkey',
  'sqlite',
  'clickhouse',
  'elasticsearch',
  'rabbitmq',
  'minio',
  'influxdb',
  'neo4j',
];

export const GUIDE_PATHS: readonly string[] = GUIDE_SLUGS.map(
  (slug) => `/guides/backup-${slug}-docker`,
);

/** Self-hosted app use-case slugs → `/backup/<slug>-docker`. */
export const USECASE_SLUGS: readonly string[] = [
  'wordpress',
  'ghost',
  'n8n',
  'supabase',
  'nextcloud',
  'gitea',
  'plausible',
  'umami',
  'directus',
  'strapi',
  'appwrite',
  'pocketbase',
  'matomo',
  'mattermost',
  'vaultwarden',
  'uptime-kuma',
  'metabase',
  'nocodb',
];

export const USECASE_PATHS: readonly string[] = USECASE_SLUGS.map(
  (slug) => `/backup/${slug}-docker`,
);

/** AI + search crawlers we explicitly welcome (each gets `Allow: /`). */
export const ALLOWED_CRAWLERS: readonly string[] = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'PerplexityBot',
  'ClaudeBot',
  'anthropic-ai',
  'Claude-Web',
  'Google-Extended',
  'Googlebot',
  'Bingbot',
];

/** Paths kept out of the index for the wildcard user-agent. */
export const DISALLOWED_PATHS: readonly string[] = [
  '/dashboard',
  '/api',
  '/admin',
  '/billing',
  '/checkout',
  '/login',
  '/register',
];

/** Escape a string for safe inclusion in XML text / attribute values. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build the absolute URL for a locale + path. English (`DEFAULT_LOCALE`) is
 * served on the un-prefixed path; every other locale is prefixed with
 * `/<locale>`.
 */
export function localizedUrl(origin: string, locale: SeoLocale, path: string): string {
  const base = origin.replace(/\/$/, '');
  const suffix = path === '/' ? '' : path;
  if (locale === DEFAULT_LOCALE) {
    return `${base}${suffix || '/'}`;
  }
  return `${base}/${locale}${suffix}`;
}

/**
 * Build a single `<url>` entry (as an XML string) for the given path, including
 * the un-prefixed English `<loc>`, one `<xhtml:link>` alternate per locale, and
 * an `x-default` alternate pointing at the un-prefixed path.
 */
export function buildUrlEntry(origin: string, path: string, lastmod: string): string {
  const loc = escapeXml(localizedUrl(origin, DEFAULT_LOCALE, path));
  const xDefault = escapeXml(localizedUrl(origin, DEFAULT_LOCALE, path));

  const alternates = LOCALES.map((locale) => {
    const href = escapeXml(localizedUrl(origin, locale, path));
    return `    <xhtml:link rel="alternate" hreflang="${locale}" href="${href}"/>`;
  });
  alternates.push(
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${xDefault}"/>`,
  );

  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <lastmod>${escapeXml(lastmod)}</lastmod>`,
    ...alternates,
    '  </url>',
  ].join('\n');
}
