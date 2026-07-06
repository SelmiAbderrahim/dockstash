// React hook over the copy registry. SSR and first hydration always hit the
// cache (the entries preload it), so this hook only performs an async load on
// client-side navigation into /guides or a locale switch — re-rendering when
// the bundle lands. Until then it serves the English bundle as a fallback
// (crawlers never see this: they get the fully-loaded SSR HTML).

import { useEffect, useReducer } from 'react';
import type { SupportedLocale } from '@shared/i18n';
import type { GuideCopyBundle } from './locale/types';
import { getGuideCopy, hasGuideCopy, loadGuideCopy } from './copy-registry';

export function useGuideCopy(locale: SupportedLocale): GuideCopyBundle | undefined {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const ready = hasGuideCopy(locale);

  useEffect(() => {
    if (ready) return undefined;
    let cancelled = false;
    void loadGuideCopy(locale).then(() => {
      if (!cancelled) bump();
    });
    return () => {
      cancelled = true;
    };
  }, [locale, ready]);

  return getGuideCopy(locale);
}
