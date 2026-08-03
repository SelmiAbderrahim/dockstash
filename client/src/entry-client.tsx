import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { App } from './App';
import { store } from './app/store';
import { createAppRouter } from './app/router';
import { initI18n } from '@shared/i18n';
// Self-hosted fonts (bundled locally by Vite — no external CDN request).
// Variable-weight Inter (latin) for UI; JetBrains Mono for code blocks.
import '@fontsource-variable/inter/wght.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
// Instrument Serif italic — display accent word inside headline text.
import '@fontsource/instrument-serif/400-italic.css';
// Arabic script coverage (Inter/Instrument Serif have none): variable-weight
// Noto Sans Arabic for UI text, Noto Naskh Arabic for the serif display accent.
// Both are unicode-range-subset — browsers fetch them only when Arabic glyphs
// actually appear on the page.
import '@fontsource-variable/noto-sans-arabic/wght.css';
import '@fontsource/noto-naskh-arabic/400.css';
import './styles/tailwind.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found in index.html');
}

// Locale comes from the `lang` cookie / navigator detection — there are no
// locale-prefixed URLs to honour.
const i18n = initI18n();

createRoot(container).render(
  <StrictMode>
    <App store={store} i18n={i18n}>
      <RouterProvider router={createAppRouter()} />
    </App>
  </StrictMode>,
);
