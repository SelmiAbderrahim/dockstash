import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { localizedUrl, DEFAULT_LOCALE } from './seo.data.js';

const app = createApp();

describe('seo.data.localizedUrl', () => {
  it('serves the root path un-prefixed for the default locale', () => {
    expect(localizedUrl('https://x.io/', DEFAULT_LOCALE, '/')).toBe('https://x.io/');
  });

  it('appends a non-root path for the default locale', () => {
    expect(localizedUrl('https://x.io', DEFAULT_LOCALE, '/pricing')).toBe(
      'https://x.io/pricing',
    );
  });

  it('prefixes non-default locales with the locale segment', () => {
    expect(localizedUrl('https://x.io', 'ar', '/pricing')).toBe('https://x.io/ar/pricing');
  });
});

describe('seo module', () => {
  it('serves robots.txt as text/plain with crawler allows and disallows', async () => {
    const res = await request(app).get('/robots.txt');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('GPTBot');
    expect(res.text).toContain('PerplexityBot');
    expect(res.text).toContain('ClaudeBot');
    expect(res.text).toContain('Disallow: /dashboard');
    expect(res.text).toMatch(/^Sitemap: .+\/sitemap\.xml$/m);
  });

  it('serves the sitemap index referencing the child sitemaps', async () => {
    const res = await request(app).get('/sitemap.xml');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/xml/);
    expect(res.text).toContain('<sitemapindex');
    expect(res.text).toContain('/sitemap-core.xml');
    expect(res.text).toContain('/sitemap-alternatives.xml');
    expect(res.text).toContain('/sitemap-guides.xml');
    expect(res.text).toContain('/sitemap-usecases.xml');
  });

  it('serves the guides urlset with localized hreflang alternates', async () => {
    const res = await request(app).get('/sitemap-guides.xml');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/xml/);
    expect(res.text).toContain('<urlset');
    expect(res.text).toContain('backup-postgres-docker');
    expect(res.text).toContain('hreflang="ar"');
    expect(res.text).toContain('hreflang="x-default"');
  });
});
