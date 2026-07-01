import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  type SupportedLocale,
} from '@shared/i18n';

/**
 * Canonical public origin used to build absolute URLs (canonical, OG,
 * hreflang). Derived from build-time env; never hardcode a domain in
 * component code. Falls back to the production domain.
 */
export const SITE_URL = (
  (import.meta.env.VITE_SITE_URL as string | undefined) ?? 'https://dockstash.com'
).replace(/\/+$/, '');

export const SITE_NAME = 'Dockstash';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og/default.png`;
export const TWITTER_HANDLE = '@dockstash';

/** Prefix a path with its locale segment (English is un-prefixed / x-default). */
export function localizedPath(path: string, locale: SupportedLocale): string {
  const clean = path === '/' ? '' : path;
  return locale === DEFAULT_LOCALE ? path : `/${locale}${clean}` || '/';
}

/** Absolute URL for a path (already includes any locale prefix). */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export interface HreflangAlternate {
  hrefLang: string;
  href: string;
}

/**
 * Full hreflang cluster for a base (un-prefixed, English) path: one entry
 * per locale plus `x-default` → the un-prefixed URL.
 */
export function hreflangAlternates(basePath: string): HreflangAlternate[] {
  const alternates: HreflangAlternate[] = SUPPORTED_LOCALES.map((locale) => ({
    hrefLang: locale,
    href: absoluteUrl(localizedPath(basePath, locale)),
  }));
  alternates.push({ hrefLang: 'x-default', href: absoluteUrl(basePath) });
  return alternates;
}

/** Self-referential canonical for a given locale variant of a base path. */
export function canonicalFor(basePath: string, locale: SupportedLocale): string {
  return absoluteUrl(localizedPath(basePath, locale));
}
