import { describe, expect, it } from 'vitest';
import {
  localizedPath,
  absoluteUrl,
  hreflangAlternates,
  canonicalFor,
  SITE_URL,
} from './meta';

describe('seo/meta', () => {
  it('localizedPath keeps English un-prefixed and prefixes other locales', () => {
    expect(localizedPath('/', 'en')).toBe('/');
    expect(localizedPath('/pricing', 'en')).toBe('/pricing');
    expect(localizedPath('/pricing', 'fr')).toBe('/fr/pricing');
    // The root path collapses so we don't emit a trailing slash after the locale.
    expect(localizedPath('/', 'de')).toBe('/de');
  });

  it('absoluteUrl normalises the leading slash', () => {
    expect(absoluteUrl('/x')).toBe(`${SITE_URL}/x`);
    expect(absoluteUrl('x')).toBe(`${SITE_URL}/x`);
  });

  it('hreflangAlternates covers every locale plus x-default', () => {
    const alts = hreflangAlternates('/pricing');
    expect(alts.some((a) => a.hrefLang === 'x-default')).toBe(true);
    expect(alts.some((a) => a.hrefLang === 'fr')).toBe(true);
    expect(alts.find((a) => a.hrefLang === 'x-default')?.href).toBe(absoluteUrl('/pricing'));
  });

  it('canonicalFor returns the locale-specific absolute URL', () => {
    expect(canonicalFor('/pricing', 'en')).toBe(absoluteUrl('/pricing'));
    expect(canonicalFor('/pricing', 'fr')).toBe(absoluteUrl('/fr/pricing'));
  });
});
