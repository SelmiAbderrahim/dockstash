import i18n, { type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { loadCookie, saveCookie } from '@shared/utils/cookies';
import {
  DEFAULT_LOCALE,
  LANGUAGE_COOKIE,
  NAMESPACES,
  SUPPORTED_LOCALES,
  isRtl,
  isSupportedLocale,
} from './locales';
import type { SupportedLocale } from './locales';
import { RESOURCES } from './resources';

export {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  LANGUAGE_COOKIE,
  NAMESPACES,
  isSupportedLocale,
  isRtl,
} from './locales';
export type { SupportedLocale, Namespace } from './locales';

const COOKIE_MAX_AGE_ONE_YEAR = 60 * 60 * 24 * 365;

export function readStoredLocale(): SupportedLocale | null {
  const raw = loadCookie<string>(LANGUAGE_COOKIE);
  return isSupportedLocale(raw) ? raw : null;
}

export function persistLocale(locale: SupportedLocale): void {
  saveCookie(LANGUAGE_COOKIE, locale, {
    path: '/',
    maxAge: COOKIE_MAX_AGE_ONE_YEAR,
    sameSite: 'lax',
  });
}

export function applyLocaleToDocument(locale: SupportedLocale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr';
}

interface InitOptions {
  initialLocale?: SupportedLocale;
}

let initialized = false;

export function initI18n(options: InitOptions = {}): typeof i18n {
  if (initialized) return i18n;
  initialized = true;

  const stored = readStoredLocale();
  const forcedLocale: SupportedLocale | undefined =
    options.initialLocale ?? stored ?? undefined;

  const resources = Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [locale, RESOURCES[locale]]),
  );

  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: resources as Resource,
      ...(forcedLocale ? { lng: forcedLocale } : {}),
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: SUPPORTED_LOCALES as unknown as string[],
      ns: NAMESPACES as unknown as string[],
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      detection: {
        order: ['cookie', 'navigator'],
        lookupCookie: LANGUAGE_COOKIE,
        caches: [],
      },
      returnEmptyString: false,
    });

  const active = (isSupportedLocale(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : DEFAULT_LOCALE) as SupportedLocale;
  applyLocaleToDocument(active);
  i18n.on('languageChanged', (lng) => {
    if (isSupportedLocale(lng)) {
      persistLocale(lng);
      applyLocaleToDocument(lng);
    }
  });

  return i18n;
}

export async function changeLanguage(locale: SupportedLocale): Promise<void> {
  if (!isSupportedLocale(locale)) return;
  await i18n.changeLanguage(locale);
}

export { i18n };
