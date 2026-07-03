import { describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { Seo, safeJsonLd } from './Seo';

const renderSeo = (props: Partial<React.ComponentProps<typeof Seo>> = {}) =>
  render(
    <HelmetProvider>
      <Seo title="T" description="D" basePath="/pricing" locale="en" {...props} />
    </HelmetProvider>,
  );

describe('Seo', () => {
  it('renders the default (indexable, website, object json-ld) variant', () => {
    expect(() =>
      renderSeo({ jsonLd: { '@type': 'WebSite' } }),
    ).not.toThrow();
  });

  it('renders with no json-ld provided', () => {
    expect(() => renderSeo()).not.toThrow();
  });

  it('emits Open Graph image dimensions', async () => {
    renderSeo();
    await waitFor(() => {
      expect(
        document.head.querySelector('meta[property="og:image:width"]')?.getAttribute('content'),
      ).toBe('1200');
    });
    expect(
      document.head.querySelector('meta[property="og:image:height"]')?.getAttribute('content'),
    ).toBe('630');
  });

  it('safeJsonLd escapes script-context breakout characters', () => {
    const out = safeJsonLd({ name: '</script><script>alert(1)</script>', amp: 'a&b' });
    // No raw breakout sequences survive.
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).not.toContain('&');
    expect(out).toContain('\\u003c');
    expect(out).toContain('\\u003e');
    expect(out).toContain('\\u0026');
    // Still valid JSON that round-trips to the original values.
    expect(JSON.parse(out)).toEqual({
      name: '</script><script>alert(1)</script>',
      amp: 'a&b',
    });
  });

  it('safeJsonLd escapes U+2028 / U+2029 line separators', () => {
    const raw = `a\u2028b\u2029c`;
    const out = safeJsonLd({ s: raw });
    expect(out).toContain('\\u2028');
    expect(out).toContain('\\u2029');
    expect(out).not.toContain('\u2028');
    expect(out).not.toContain('\u2029');
    expect(JSON.parse(out)).toEqual({ s: raw });
  });

  it('renders the noindex + article + rtl + json-ld-array variant', () => {
    expect(() =>
      renderSeo({
        locale: 'ar',
        noindex: true,
        type: 'article',
        datePublished: '2026-01-01',
        dateModified: '2026-02-02',
        image: 'https://x/og.png',
        jsonLd: [{ '@type': 'A' }, { '@type': 'B' }],
      }),
    ).not.toThrow();
  });
});
