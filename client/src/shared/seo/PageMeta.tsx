import { Helmet } from 'react-helmet-async';
import { SITE_NAME } from './meta';

export interface PageMetaProps {
  title: string;
  description: string;
}

/**
 * Minimal head tags for private/utility CSR pages (auth, dashboard).
 * Always `noindex` — these URLs are Disallow'd in robots.txt and must never
 * rank. Marketing pages use `<Seo>` (canonical/hreflang/OG) instead.
 */
export const PageMeta = ({ title, description }: PageMetaProps) => (
  <Helmet titleTemplate={`%s · ${SITE_NAME}`}>
    <title>{title}</title>
    <meta name="description" content={description} />
    <meta name="robots" content="noindex, follow" />
  </Helmet>
);
