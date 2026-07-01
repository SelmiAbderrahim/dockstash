import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

const app = createApp();

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
