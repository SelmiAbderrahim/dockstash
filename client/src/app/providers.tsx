import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { DirectionProvider } from '@radix-ui/react-direction';
import type { i18n as I18nType } from 'i18next';
import { isRtl } from '@shared/i18n/locales';
import { ThemeProvider } from '@shared/theme/ThemeProvider';
import { TooltipProvider } from '@shared/ui/tooltip';
import { Toaster } from '@shared/ui/sonner';
import type { AppStore } from './store';

interface ProvidersProps {
  /** Redux store — the browser singleton, or a fresh one per test. */
  store: AppStore;
  /** i18next instance — injected for the same reason. */
  i18n: I18nType;
  children: ReactNode;
}

/**
 * App-wide providers. Store and i18n are injected (not imported as module
 * singletons) so tests can mount isolated instances. No side effects at module
 * load — i18n is initialised by the entry point.
 */
export const Providers = ({ store, i18n, children }: ProvidersProps) => {
  const dir = isRtl(i18n.language as never) ? 'rtl' : 'ltr';
  return (
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <DirectionProvider dir={dir}>
          <ThemeProvider>
            <TooltipProvider>
              {children}
              <Toaster position="top-right" />
            </TooltipProvider>
          </ThemeProvider>
        </DirectionProvider>
      </I18nextProvider>
    </Provider>
  );
};
