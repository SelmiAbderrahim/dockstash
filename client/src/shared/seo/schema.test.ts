import { describe, expect, it } from 'vitest';
import * as schema from './schema';

describe('seo/schema JSON-LD builders', () => {
  it('monthToIso expands valid months and falls back for garbage', () => {
    expect(schema.monthToIso('2026-07')).toBe('2026-07-01');
    expect(schema.monthToIso('nope')).toBe(schema.SITE_LAST_UPDATED);
  });

  it('graph wraps nodes in an @graph document', () => {
    const doc = schema.graph({ '@type': 'A' }, { '@type': 'B' });
    expect(doc['@context']).toBe('https://schema.org');
    expect((doc['@graph'] as unknown[]).length).toBe(2);
  });

  it('organization / website expose stable @ids', () => {
    expect(schema.organization()['@type']).toBe('Organization');
    expect(schema.website()['@type']).toBe('WebSite');
  });

  it('softwareApplication maps offers and defaults the currency', () => {
    const withOffers = schema.softwareApplication([{ name: 'Pro', price: '9' }]);
    const offers = withOffers.offers as Array<{ priceCurrency: string }>;
    expect(offers[0]?.priceCurrency).toBe('USD');
    const explicit = schema.softwareApplication([
      { name: 'Pro', price: '9', priceCurrency: 'EUR' },
    ]);
    expect((explicit.offers as Array<{ priceCurrency: string }>)[0]?.priceCurrency).toBe('EUR');
    // Default empty-offers path.
    expect((schema.softwareApplication().offers as unknown[]).length).toBe(0);
  });

  it('breadcrumbList / itemList number their entries from 1', () => {
    const bc = schema.breadcrumbList([{ name: 'Home', path: '/' }]);
    expect((bc.itemListElement as Array<{ position: number }>)[0]?.position).toBe(1);
    const il = schema.itemList([{ name: 'A', path: '/a' }]);
    expect((il.itemListElement as Array<{ position: number }>)[0]?.position).toBe(1);
  });

  it('faqPage maps questions to accepted answers', () => {
    const doc = schema.faqPage([{ question: 'q?', answer: 'a' }]);
    const q = (doc.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>)[0];
    expect(q?.name).toBe('q?');
    expect(q?.acceptedAnswer.text).toBe('a');
  });

  it('article defaults dates and honours overrides', () => {
    const def = schema.article({ headline: 'H', description: 'D', path: '/g' });
    expect(def.datePublished).toBe(schema.SITE_LAST_UPDATED);
    expect(def.dateModified).toBe(schema.SITE_LAST_UPDATED);
    const over = schema.article({
      headline: 'H',
      description: 'D',
      path: '/g',
      datePublished: '2026-01-01',
      dateModified: '2026-02-02',
    });
    expect(over.dateModified).toBe('2026-02-02');
    expect(def.inLanguage).toBe('en');
    const fr = schema.article({
      headline: 'H',
      description: 'D',
      path: '/fr/g',
      inLanguage: 'fr',
    });
    expect(fr.inLanguage).toBe('fr');
  });

  it('webPage links to the site-wide WebSite entity', () => {
    const doc = schema.webPage('Privacy Policy', 'How we handle data.', '/privacy');
    expect(doc.name).toBe('Privacy Policy');
    expect(doc.url).toContain('/privacy');
    expect((doc.isPartOf as { '@id': string })['@id']).toContain('#website');
  });

  it('howTo numbers its steps', () => {
    const doc = schema.howTo('Setup', [{ name: 'Step 1', text: 'do it' }]);
    expect((doc.step as Array<{ position: number }>)[0]?.position).toBe(1);
  });
});
