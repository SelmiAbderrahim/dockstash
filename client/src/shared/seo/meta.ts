import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  type SupportedLocale,
} from '@shared/i18n';
import {
  BRAND_ASSETS,
  BRAND_NAME,
  BRAND_SOCIAL_HANDLE,
} from '@shared/brand';

/**
 * Canonical public origin used to build absolute URLs (canonical, OG,
 * hreflang). Derived from build-time env; never hardcode a domain in
 * component code. On the client it can fall back to the current origin;
 * SSR should provide VITE_SITE_URL for absolute crawler URLs.
 */
/* c8 ignore start -- build-time env / SSR-vs-browser origin resolution, fixed per environment */
export const SITE_URL = (
  (import.meta.env.VITE_SITE_URL as string | undefined) ??
  (typeof window === 'undefined' ? '' : window.location.origin)
).replace(/\/+$/, '');
/* c8 ignore stop */

export const SITE_NAME = BRAND_NAME;
export const DEFAULT_OG_IMAGE = absoluteUrl(BRAND_ASSETS.ogDefault);
export const TWITTER_HANDLE = BRAND_SOCIAL_HANDLE;

/** Prefix a path with its locale segment (English is un-prefixed / x-default). */
export function localizedPath(path: string, locale: SupportedLocale): string {
  const clean = path === '/' ? '' : path;
  return locale === DEFAULT_LOCALE ? path : `/${locale}${clean}`;
}

/** Absolute URL for a path (already includes any locale prefix). */
export function absoluteUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  // The empty-SITE_URL arm only occurs under SSR without VITE_SITE_URL.
  /* c8 ignore next */
  return SITE_URL ? `${SITE_URL}${normalizedPath}` : normalizedPath;
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
