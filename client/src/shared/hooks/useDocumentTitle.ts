import { useEffect } from 'react';
import { BRAND_NAME } from '@shared/brand';

/**
 * Sets `document.title` for a client-rendered screen. The whole app is a
 * private SPA behind auth, so there is nothing to index and no head-tag
 * management library — a plain effect is the entire requirement.
 */
export const useDocumentTitle = (title: string): void => {
  useEffect(() => {
    document.title = `${title} · ${BRAND_NAME}`;
  }, [title]);
};
