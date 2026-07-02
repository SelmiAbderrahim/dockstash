// Behavioral guard on the SSR entry (coverage-excluded, like entry-server
// itself): unknown URLs must produce a real 404 status, known pages a 200.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HelmetProvider } from 'react-helmet-async';
import { render } from './entry-server';

// jsdom makes react-helmet-async think it's in a browser, which skips filling
// the server-side helmet context — force SSR mode for these tests.
beforeAll(() => {
  HelmetProvider.canUseDOM = false;
});
afterAll(() => {
  HelmetProvider.canUseDOM = true;
});

describe('entry-server render statuses', () => {
  it('returns 200 with head tags for a known marketing page', async () => {
    const result = await render('/pricing');
    expect(result.statusCode).toBe(200);
    expect(result.appHtml).not.toBe('');
    expect(result.headTags).toContain('<title');
    expect(result.headTags).toContain('rel="canonical"');
  });

  it('returns 200 with locale html attributes for a localized page', async () => {
    const result = await render('/fr');
    expect(result.statusCode).toBe(200);
    expect(result.htmlAttrs).toContain('lang="fr"');
  });

  it('returns 404 with noindex HTML for an unknown URL', async () => {
    const result = await render('/definitely-not-a-page');
    expect(result.statusCode).toBe(404);
    expect(result.appHtml).not.toBe('');
    expect(result.headTags).toContain('noindex');
  });

  it('returns 404 for an unknown programmatic slug', async () => {
    const result = await render('/guides/backup-does-not-exist-docker');
    expect(result.statusCode).toBe(404);
    expect(result.headTags).toContain('noindex');
  });
});
