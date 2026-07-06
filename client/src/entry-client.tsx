import { StrictMode } from 'react';
import { hydrateRoot, createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { App } from './App';
import { store } from './app/store';
import { createAppRouter } from './app/router';
import { initI18n } from '@shared/i18n';
import {
  MARKETING_LOCALE_PREFIXES,
  resolveMarketingRoute,
} from '@features/marketing/useMarketingRoute';
import { isGuidePath, loadGuideCopy } from '@features/marketing/content';
// Self-hosted fonts (bundled locally by Vite — no external CDN request).
// Variable-weight Inter (latin) for UI; JetBrains Mono for code blocks.
import '@fontsource-variable/inter/wght.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
// Instrument Serif italic — display accent word inside marketing headlines only.
import '@fontsource/instrument-serif/400-italic.css';
import './styles/tailwind.css';

declare global {
  interface Window {
    /** Set by the SSR shell so we hydrate instead of client-rendering. */
    __SSR__?: boolean;
  }
}

const rootContainer = document.getElementById('root');
if (!rootContainer) {
  throw new Error('Root container #root not found in index.html');
}
// Narrowed alias — TS does not carry the throw-guard narrowing into the
// async boot() closure below.
const container: HTMLElement = rootContainer;

// If the URL carries a locale prefix (a server-rendered marketing page),
// force i18n to that locale so hydration matches; otherwise fall back to the
// app's cookie/navigator detection (unchanged authenticated-app behavior).
const firstSegment = window.location.pathname.split('/').filter(Boolean)[0];
const urlLocale = MARKETING_LOCALE_PREFIXES.find((l) => l === firstSegment);
const i18n = initI18n(urlLocale ? { initialLocale: urlLocale } : {});

const router = createAppRouter();

const tree = (
  <StrictMode>
    <App store={store} i18n={i18n}>
      <RouterProvider router={router} />
    </App>
  </StrictMode>
);

// A server-rendered guide page was rendered WITH its locale's copy bundle in
// the registry cache. Hydration must see the same bundle synchronously or the
// client renders the loading skeleton over real SSR HTML (hydration
// mismatch). Await the (cached-chunk) import before hydrating.
async function boot(): Promise<void> {
  if (window.__SSR__) {
    const { locale, basePath } = resolveMarketingRoute(window.location.pathname);
    if (isGuidePath(basePath)) {
      await loadGuideCopy(locale);
    }
    hydrateRoot(container, tree);
  } else {
    createRoot(container).render(tree);
  }
}

void boot();
