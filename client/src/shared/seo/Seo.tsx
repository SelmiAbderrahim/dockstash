import { Helmet } from 'react-helmet-async';
import { DEFAULT_LOCALE, isRtl, type SupportedLocale } from '@shared/i18n';
import {
  SITE_NAME,
  DEFAULT_OG_IMAGE,
  TWITTER_HANDLE,
  canonicalFor,
  hreflangAlternates,
} from './meta';

/**
 * Serialize a JSON-LD document for safe embedding inside a `<script>` element.
 * `JSON.stringify` does not escape `<`, `>` or `&`, so a value containing
 * `</script>` (or a `<!--` sequence) would break out of the script tag in the
 * server-rendered HTML. Escaping these to unicode escapes keeps the JSON valid
 * while making script-context breakout impossible. `U+2028/U+2029` are also
 * escaped as they are invalid raw in a script context.
 */
export function safeJsonLd(doc: unknown): string {
  return JSON.stringify(doc)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export interface SeoProps {
  /** Page <title> (Helmet appends the site name). */
  title: string;
  /** Meta description (~150–160 chars). */
  description: string;
  /** Un-prefixed (English) path, e.g. "/alternatives/backrest". */
  basePath: string;
  /** Active locale — drives canonical, hreflang self-ref, html lang/dir. */
  locale: SupportedLocale;
  /**
   * Whether the page content is actually translated per locale. Default true.
   * When false (programmatic English-only pages served under locale prefixes),
   * the canonical points at the un-prefixed English URL, no hreflang
   * alternates are emitted, og:locale is 'en' (no alternates), and the html
   * lang stays 'en' — so locale-prefixed duplicates consolidate onto the
   * English URL instead of competing as thin near-duplicates.
   */
  localized?: boolean;
  /** Absolute OG image URL. Defaults to the site image. */
  image?: string;
  type?: 'website' | 'article';
  /** When true, emit robots noindex (thin/low-data programmatic pages). */
  noindex?: boolean;
  /** ISO date the content was first published (article pages). */
  datePublished?: string;
  /** ISO date the content was last updated (article pages, freshness signal). */
  dateModified?: string;
  /** JSON-LD document(s) — usually a single `graph(...)` object. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

/**
 * Declarative <head> for a marketing page. Renders title, description,
 * canonical, Open Graph, Twitter Card, the full hreflang cluster, robots,
 * and JSON-LD. On the server react-helmet-async serialises this into the
 * SSR HTML; on the client it updates the document head on navigation.
 */
export const Seo = ({
  title,
  description,
  basePath,
  locale,
  localized = true,
  image = DEFAULT_OG_IMAGE,
  type = 'website',
  noindex = false,
  datePublished,
  dateModified,
  jsonLd,
}: SeoProps) => {
  // Untranslated pages are English regardless of the URL prefix: canonical is
  // the un-prefixed English URL, and the document language is 'en'.
  const contentLocale: SupportedLocale = localized ? locale : DEFAULT_LOCALE;
  const canonical = canonicalFor(basePath, contentLocale);
  const alternates = localized ? hreflangAlternates(basePath) : [];
  // og:locale:alternate — real hreflang locales other than the active one and
  // x-default, so social crawlers surface the localized variants.
  const ogAlternateLocales = alternates
    .filter((alt) => alt.hrefLang !== 'x-default' && alt.hrefLang !== contentLocale)
    .map((alt) => alt.hrefLang);
  const jsonLdDocs = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet
      htmlAttributes={{
        lang: contentLocale,
        dir: isRtl(contentLocale) ? 'rtl' : 'ltr',
      }}
      titleTemplate={`%s · ${SITE_NAME}`}
      defaultTitle={SITE_NAME}
    >
      <title>{title}</title>
      <meta name="description" content={description} />
      {noindex ? (
        <meta name="robots" content="noindex, follow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}
      <link rel="canonical" href={canonical} />

      {/* hreflang cluster */}
      {alternates.map((alt) => (
        <link
          key={alt.hrefLang}
          rel="alternate"
          hrefLang={alt.hrefLang}
          href={alt.href}
        />
      ))}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={image} />
      {/* All OG artwork is authored at the standard 1200×630 (scripts/optimize-og-image.mjs enforces it for the default). */}
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content={contentLocale} />
      {ogAlternateLocales.map((alt) => (
        <meta key={alt} property="og:locale:alternate" content={alt} />
      ))}
      {type === 'article' && datePublished && (
        <meta property="article:published_time" content={datePublished} />
      )}
      {type === 'article' && dateModified && (
        <meta property="article:modified_time" content={dateModified} />
      )}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={TWITTER_HANDLE} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {jsonLdDocs.map((doc, index) => (
        <script key={index} type="application/ld+json">
          {safeJsonLd(doc)}
        </script>
      ))}
    </Helmet>
  );
};
