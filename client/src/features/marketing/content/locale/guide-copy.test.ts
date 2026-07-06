// Cross-locale parity contract for the guide copy bundles. This is the
// analogue of the i18next key-parity test for the (non-i18next) guide prose:
// every locale must cover every slug, every step id, and every template slot
// with the same structural shape as English.

import { describe, it, expect } from 'vitest';
import { SERVICE_GUIDES, SERVICE_GUIDE_SLUGS } from '../guides';
import { PLATFORM_GUIDES, PLATFORM_GUIDE_SLUGS } from '../platform-guides';
import { guideIntro } from '../transform';
import type { GuideCopyBundle } from './types';
import { GUIDE_COPY as en } from './guides.en';
import { GUIDE_COPY as ar } from './guides.ar';
import { GUIDE_COPY as fr } from './guides.fr';
import { GUIDE_COPY as de } from './guides.de';
import { GUIDE_COPY as es } from './guides.es';
import { GUIDE_COPY as ru } from './guides.ru';
import { GUIDE_COPY as zh } from './guides.zh';

const BUNDLES: Record<string, GuideCopyBundle> = { en, ar, fr, de, es, ru, zh };

describe.each(Object.entries(BUNDLES))('guide copy bundle: %s', (_locale, bundle) => {
  it('covers every service slug and every platform slug', () => {
    expect(new Set(Object.keys(bundle.services))).toEqual(new Set(SERVICE_GUIDE_SLUGS));
    expect(new Set(Object.keys(bundle.platform))).toEqual(new Set(PLATFORM_GUIDE_SLUGS));
  });

  it('keeps the template bank aligned with English', () => {
    expect(bundle.templates.intro).toHaveLength(en.templates.intro.length);
    expect(new Set(Object.keys(bundle.templates.consistency))).toEqual(
      new Set(SERVICE_GUIDE_SLUGS),
    );
    for (const template of bundle.templates.intro) {
      expect(template.trim().length).toBeGreaterThan(0);
    }
  });

  it('covers every walkthrough and restore step id per service, with full prose', () => {
    for (const slug of SERVICE_GUIDE_SLUGS) {
      const facts = SERVICE_GUIDES[slug]!;
      const copy = bundle.services[slug]!;

      expect(new Set(Object.keys(copy.walkthrough))).toEqual(
        new Set(facts.walkthrough.map((step) => step.id)),
      );
      expect(new Set(Object.keys(copy.restoreVerify.steps))).toEqual(
        new Set(facts.restoreVerify.map((step) => step.id)),
      );
      expect(copy.restoreVerify.intro.trim().length).toBeGreaterThan(0);

      for (const step of Object.values(copy.walkthrough)) {
        expect(step.title.trim().length).toBeGreaterThan(0);
        expect(step.body.trim().length).toBeGreaterThan(0);
      }
      for (const step of Object.values(copy.restoreVerify.steps)) {
        expect(step.title.trim().length).toBeGreaterThan(0);
        expect(step.body.trim().length).toBeGreaterThan(0);
      }

      expect(copy.troubleshooting.length).toBeGreaterThanOrEqual(3);
      for (const item of copy.troubleshooting) {
        expect(item.symptom.trim().length).toBeGreaterThan(0);
        expect(item.cause.trim().length).toBeGreaterThan(0);
        expect(item.fix.trim().length).toBeGreaterThan(0);
      }

      expect(copy.gotchas.length).toBeGreaterThanOrEqual(3);
      expect(copy.faq.length).toBeGreaterThanOrEqual(6);
      expect(copy.faq.length).toBeLessThanOrEqual(8);
      for (const faq of copy.faq) {
        expect(faq.question.trim().length).toBeGreaterThan(0);
        expect(faq.answer.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('covers every platform step id, with intro and 4–6 FAQs', () => {
    for (const slug of PLATFORM_GUIDE_SLUGS) {
      const facts = PLATFORM_GUIDES[slug]!;
      const copy = bundle.platform[slug]!;

      expect(new Set(Object.keys(copy.steps))).toEqual(
        new Set(facts.steps.map((step) => step.id)),
      );
      expect(copy.intro.trim().length).toBeGreaterThan(0);
      for (const step of Object.values(copy.steps)) {
        expect(step.title.trim().length).toBeGreaterThan(0);
        expect(step.body.trim().length).toBeGreaterThan(0);
      }
      expect(copy.faq.length).toBeGreaterThanOrEqual(4);
      expect(copy.faq.length).toBeLessThanOrEqual(6);
    }
  });

  it('resolves every intro template slot for every guide (no {{leaks}})', () => {
    for (const slug of SERVICE_GUIDE_SLUGS) {
      const intro = guideIntro(SERVICE_GUIDES[slug]!, bundle);
      expect(intro).not.toMatch(/\{\{/);
      expect(intro.length).toBeGreaterThan(40);
    }
  });
});

describe('translated bundles are real translations', () => {
  it.each(['ar', 'fr', 'de', 'es', 'ru', 'zh'])(
    '%s differs from the English bundle',
    (locale) => {
      const bundle = BUNDLES[locale]!;
      expect(bundle).not.toBe(en);
      // Spot-check: the postgres first-step title must not be the English one.
      expect(bundle.services.postgres!.walkthrough['add-server']!.title).not.toBe(
        en.services.postgres!.walkthrough['add-server']!.title,
      );
      expect(bundle.platform['connect-fleet-agent']!.intro).not.toBe(
        en.platform['connect-fleet-agent']!.intro,
      );
    },
  );
});
