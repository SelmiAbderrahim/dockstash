import type { ReactNode } from 'react';
import type { i18n as I18nType } from 'i18next';
import { Providers } from './app/providers';
import type { AppStore } from './app/store';

interface AppProps {
  store: AppStore;
  i18n: I18nType;
  /** The router element — normally `RouterProvider`. */
  children: ReactNode;
}

/**
 * Root shell. Store, i18n, and the router element are injected by the entry
 * point so tests can mount the same tree with their own instances.
 */
export const App = ({ store, i18n, children }: AppProps) => (
  <Providers store={store} i18n={i18n}>
    {children}
  </Providers>
);
