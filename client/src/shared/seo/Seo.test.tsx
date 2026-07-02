import { describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { Seo } from './Seo';

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
