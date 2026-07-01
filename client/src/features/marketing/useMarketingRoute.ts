import { useLocation } from 'react-router-dom';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  type SupportedLocale,
} from '@shared/i18n';

const NON_DEFAULT_LOCALES = SUPPORTED_LOCALES.filter(
  (locale) => locale !== DEFAULT_LOCALE,
);

/** Locale prefixes that appear in marketing URLs (English is un-prefixed). */
export const MARKETING_LOCALE_PREFIXES = NON_DEFAULT_LOCALES;

/**
 * Split a marketing pathname into its locale and un-prefixed base path.
 * `/ar/pricing` → { locale: 'ar', basePath: '/pricing' }.
 * `/pricing`    → { locale: 'en', basePath: '/pricing' }.
 * Pure — usable on the server (entry-server) and in the browser.
 */
export function resolveMarketingRoute(pathname: string): {
  locale: SupportedLocale;
  basePath: string;
} {
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];
  if (
    first &&
    first !== DEFAULT_LOCALE &&
    isSupportedLocale(first)
  ) {
    const rest = `/${segments.slice(1).join('/')}`;
    return { locale: first, basePath: rest === '/' ? '/' : rest.replace(/\/$/, '') };
  }
  const base = `/${segments.join('/')}`;
  return { locale: DEFAULT_LOCALE, basePath: base === '/' ? '/' : base.replace(/\/$/, '') };
}

/** Hook form of {@link resolveMarketingRoute} for use inside components. */
export function useMarketingRoute(): {
  locale: SupportedLocale;
  basePath: string;
} {
  const { pathname } = useLocation();
  return resolveMarketingRoute(pathname);
}

/** Build an in-app href that preserves the active locale prefix. */
export function localeHref(basePath: string, locale: SupportedLocale): string {
  if (locale === DEFAULT_LOCALE) return basePath;
  return basePath === '/' ? `/${locale}` : `/${locale}${basePath}`;
}
