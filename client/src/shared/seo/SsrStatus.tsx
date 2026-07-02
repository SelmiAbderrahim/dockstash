import { createContext, useContext, type ReactNode } from 'react';

/** Mutable ref the SSR entry reads after rendering to pick the HTTP status. */
export interface SsrStatusRef {
  statusCode: number;
}

const SsrStatusContext = createContext<SsrStatusRef | null>(null);

export const SsrStatusProvider = ({
  value,
  children,
}: {
  value: SsrStatusRef;
  children: ReactNode;
}) => <SsrStatusContext.Provider value={value}>{children}</SsrStatusContext.Provider>;

/**
 * Renders nothing; marks the current SSR response as a 404. Writing to a plain
 * ref during render is safe here: renderToString is synchronous and the write
 * is idempotent. In the browser the provider is absent, so this is a no-op.
 */
export const SsrNotFound = () => {
  const ref = useContext(SsrStatusContext);
  if (ref) {
    ref.statusCode = 404;
  }
  return null;
};
