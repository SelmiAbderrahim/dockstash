import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { HelmetProvider } from 'react-helmet-async';
import type { i18n as I18nType } from 'i18next';
import type { AppStore } from './store';

interface ProvidersProps {
  /** Redux store — singleton on the client, per-request on the server. */
  store: AppStore;
  /** i18next instance — singleton on the client, per-request on the server. */
  i18n: I18nType;
  /**
   * Mutable object react-helmet-async fills with the rendered head on the
   * server (read back in entry-server). Omit on the client.
   */
  helmetContext?: object;
  children: ReactNode;
}

/**
 * App-wide providers. Store and i18n are injected (not imported as
 * module singletons) so the same tree renders safely on the server, where
 * each request needs its own store + i18n instance. No side effects at
 * module load — i18n is initialised by the entry point.
 */
export const Providers = ({
  store,
  i18n,
  helmetContext,
  children,
}: ProvidersProps) => {
  return (
    <Provider store={store}>
      <HelmetProvider context={helmetContext}>
        <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
      </HelmetProvider>
    </Provider>
  );
};
