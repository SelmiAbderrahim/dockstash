export const SUPPORTED_LOCALES = ['en', 'ar', 'fr', 'de', 'es', 'ru', 'zh'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export const LANGUAGE_COOKIE = 'lang';

export const RTL_LOCALES: readonly SupportedLocale[] = ['ar'];

export const NAMESPACES = [
  'common',
  'errors',
  'auth',
  'billing',
  'email',
  'language',
  'guide',
  'health',
  'profile',
  'projects',
  'projectDetail',
  'snapshots',
  'settings',
  'wizard',
  'marketing',
  'superadmin',
] as const;

export type Namespace = (typeof NAMESPACES)[number];

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function isRtl(locale: string): boolean {
  return (RTL_LOCALES as readonly string[]).includes(locale);
}
