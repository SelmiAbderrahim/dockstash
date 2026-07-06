// Lazy per-locale loader for the guide copy bundles.
//
// The bundles are large (all guide prose for a locale) so they are ONLY
// reachable through the dynamic imports below — Vite then emits one async
// chunk per locale and the main bundle carries zero guide prose. A static
// import of any content/locale/guides.* module from app code would silently
// inline that locale into the main chunk; a guard test
// (copy-registry.test.ts) fails the build style-wise if one appears.
//
// SSR (entry-server) and hydration (entry-client) both await loadGuideCopy()
// for the active locale before rendering a /guides path, so the first render
// always sees the bundle synchronously and server/client HTML match.

import { DEFAULT_LOCALE, type SupportedLocale } from '@shared/i18n';
import type { GuideCopyBundle } from './locale/types';

type CopyModule = { GUIDE_COPY: GuideCopyBundle };

const loaders: Record<SupportedLocale, () => Promise<CopyModule>> = {
  en: () => import('./locale/guides.en'),
  ar: () => import('./locale/guides.ar'),
  fr: () => import('./locale/guides.fr'),
  de: () => import('./locale/guides.de'),
  es: () => import('./locale/guides.es'),
  ru: () => import('./locale/guides.ru'),
  zh: () => import('./locale/guides.zh'),
};

const cache = new Map<SupportedLocale, GuideCopyBundle>();
const pending = new Map<SupportedLocale, Promise<void>>();

/** True for the guides hub and any guide article base path. */
export function isGuidePath(basePath: string): boolean {
  return basePath === '/guides' || basePath.startsWith('/guides/');
}

/** True once the locale's bundle is cached (render can proceed synchronously). */
export function hasGuideCopy(locale: SupportedLocale): boolean {
  return cache.has(locale);
}

/**
 * Cached bundle for the locale, falling back to English while a non-default
 * locale is still loading (CSR locale switch), or undefined on a cold
 * client-side entry before any bundle has loaded.
 */
export function getGuideCopy(locale: SupportedLocale): GuideCopyBundle | undefined {
  return cache.get(locale) ?? cache.get(DEFAULT_LOCALE);
}

/** Idempotent: resolves immediately when cached, dedupes in-flight loads. */
export function loadGuideCopy(locale: SupportedLocale): Promise<void> {
  if (cache.has(locale)) return Promise.resolve();
  const inflight = pending.get(locale);
  if (inflight) return inflight;
  const load = loaders[locale]()
    .then((mod) => {
      cache.set(locale, mod.GUIDE_COPY);
    })
    .finally(() => {
      pending.delete(locale);
    });
  pending.set(locale, load);
  return load;
}

/** Test-only: clear the cache so load/fallback branches can be exercised. */
export function __resetGuideCopyForTests(): void {
  cache.clear();
  pending.clear();
}
