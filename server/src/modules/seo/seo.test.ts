import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { localizedUrl, isTranslatedPath, DEFAULT_LOCALE } from './seo.data.js';

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

describe('seo.data.isTranslatedPath', () => {
  it('flags translated core paths', () => {
    expect(isTranslatedPath('/')).toBe(true);
    expect(isTranslatedPath('/pricing')).toBe(true);
    expect(isTranslatedPath('/guides')).toBe(true);
  });

  it('flags every guide article path (service and platform)', () => {
    expect(isTranslatedPath('/guides/backup-postgres-docker')).toBe(true);
    expect(isTranslatedPath('/guides/connect-fleet-agent')).toBe(true);
  });

  it('rejects untranslated programmatic paths', () => {
    expect(isTranslatedPath('/privacy')).toBe(false);
    expect(isTranslatedPath('/backup/wordpress-docker')).toBe(false);
    expect(isTranslatedPath('/alternatives/backrest')).toBe(false);
  });
});

describe('seo module', () => {
  it('serves robots.txt as text/plain with crawler allows and disallows', async () => {
    const res = await request(app).get('/robots.txt');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.headers['cache-control']).toContain('max-age=3600');
    expect(res.text).toContain('GPTBot');
    expect(res.text).toContain('PerplexityBot');
    expect(res.text).toContain('ClaudeBot');
    expect(res.text).toContain('Disallow: /dashboard');
    expect(res.text).toContain('Disallow: /settings');
    expect(res.text).toContain('Disallow: /verify-email');
    expect(res.text).toMatch(/^Sitemap: .+\/sitemap\.xml$/m);
  });

  it('serves llms.txt as a markdown manifest with absolute links', async () => {
    const res = await request(app).get('/llms.txt');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.headers['cache-control']).toContain('max-age=3600');
    expect(res.text).toContain('# Dockstash');
    expect(res.text).toContain('/guides/backup-postgres-docker');
    expect(res.text).toContain('/backup/wordpress-docker');
    expect(res.text).toContain('/vs/duplicati');
    expect(res.text).toContain('/fleet-agents');
    expect(res.text).toContain('/alternatives');
    expect(res.text).toContain('[Restic cron scripts alternative]');
    expect(res.text).not.toContain('undefined');
  });

  it('serves the alternatives urlset with every /alternatives and /vs page', async () => {
    const res = await request(app).get('/sitemap-alternatives.xml');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/xml/);
    for (const slug of [
      'backrest',
      'simplebackups',
      'duplicati',
      'restic-cron-scripts',
      'provider-snapshots',
    ]) {
      expect(res.text).toContain(`/alternatives/${slug}</loc>`);
      expect(res.text).toContain(`/vs/${slug}</loc>`);
    }
    expect(res.text.match(/<loc>/g)).toHaveLength(10);
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

  it('emits hreflang alternates only for translated core paths', async () => {
    const res = await request(app).get('/sitemap-core.xml');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/xml/);

    const blocks = res.text.split('<url>').slice(1);

    // Translated page: 7 locale alternates + x-default = 8 xhtml:link lines.
    const pricing = blocks.find((block) => block.includes('/pricing</loc>'));
    expect(pricing).toBeDefined();
    expect(pricing?.match(/<xhtml:link/g)).toHaveLength(8);
    expect(pricing).toContain('hreflang="ar"');
    expect(pricing).toContain('hreflang="x-default"');

    // The root path (first entry) is translated too.
    expect(blocks[0]).toContain('<xhtml:link');

    // Untranslated core page: <loc> + <lastmod> only, zero alternates.
    const privacy = blocks.find((block) => block.includes('/privacy</loc>'));
    expect(privacy).toBeDefined();
    expect(privacy).not.toContain('<xhtml:link');
    expect(privacy).toContain('<lastmod>');
  });

  it('serves the guides urlset with hreflang alternates for every guide', async () => {
    const res = await request(app).get('/sitemap-guides.xml');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/xml/);
    expect(res.text).toContain('<urlset');
    expect(res.text).toContain('backup-postgres-docker');
    // Platform guides live in the same urlset.
    expect(res.text).toContain('/guides/connect-fleet-agent</loc>');
    expect(res.text).toContain('/guides/troubleshooting-backups</loc>');

    // 13 service guides + 8 platform guides = 21 URLs, each with
    // 7 locale alternates + x-default = 8 xhtml:link lines.
    expect(res.text.match(/<loc>/g)).toHaveLength(21);
    expect(res.text.match(/<xhtml:link/g)).toHaveLength(21 * 8);
    expect(res.text).toContain('hreflang="ar"');
    expect(res.text).toContain('hreflang="x-default"');
  });

  it('lists the platform guides in llms.txt', async () => {
    const res = await request(app).get('/llms.txt');

    expect(res.status).toBe(200);
    expect(res.text).toContain('## Platform guides');
    expect(res.text).toContain('/guides/connect-fleet-agent');
    expect(res.text).toContain('[Run restore drills](');
    expect(res.text).toContain('[Alerts and notifications](');
  });

  it('serves the alternatives and use-case urlsets without hreflang alternates', async () => {
    const alternatives = await request(app).get('/sitemap-alternatives.xml');
    expect(alternatives.status).toBe(200);
    expect(alternatives.text).not.toContain('<xhtml:link');

    const usecases = await request(app).get('/sitemap-usecases.xml');
    expect(usecases.status).toBe(200);
    expect(usecases.text).not.toContain('<xhtml:link');
  });
});
