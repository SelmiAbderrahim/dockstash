import { describe, it, expect } from 'vitest';
import { SERVICE_GUIDES, SERVICE_GUIDE_SLUGS, getServiceGuide } from './guides';
import {
  PLATFORM_GUIDES,
  PLATFORM_GUIDE_SLUGS,
  getPlatformGuide,
} from './platform-guides';
import { USE_CASES, USE_CASE_SLUGS, getUseCase } from './use-cases';
import { COMPETITORS, getCompetitor } from './competitors';
import {
  guideIntro,
  useCaseIntro,
  altIntro,
  hashSlug,
  pick,
  fill,
  consistencyNote,
} from './transform';
import { GUIDE_COPY } from './locale/guides.en';
import type { Competitor, ServiceGuide, UseCaseApp } from '../types';

describe('transform: determinism', () => {
  it('guideIntro returns the same output for the same slug across calls', () => {
    for (const guide of Object.values(SERVICE_GUIDES)) {
      const first = guideIntro(guide, GUIDE_COPY);
      const second = guideIntro(guide, GUIDE_COPY);
      const third = guideIntro(guide, GUIDE_COPY);
      expect(first).toBe(second);
      expect(second).toBe(third);
      expect(first.length).toBeGreaterThan(0);
    }
  });

  it('hashSlug is deterministic and non-negative', () => {
    expect(hashSlug('postgres')).toBe(hashSlug('postgres'));
    expect(hashSlug('postgres')).toBeGreaterThanOrEqual(0);
    expect(hashSlug('postgres')).not.toBe(hashSlug('mysql'));
  });

  it('pick is deterministic per (slug, salt)', () => {
    const opts = ['a', 'b', 'c', 'd', 'e'];
    expect(pick('postgres', opts)).toBe(pick('postgres', opts));
    expect(pick('postgres', opts, 1)).toBe(pick('postgres', opts, 1));
  });

  it('pick throws on an empty options array', () => {
    expect(() => pick('postgres', [])).toThrow(/non-empty options array/);
  });
});

describe('transform: fill', () => {
  it('interpolates every slot', () => {
    expect(fill('a {{x}} and {{y}}', { x: '1', y: '2' })).toBe('a 1 and 2');
  });

  it('throws on an unresolved slot', () => {
    expect(() => fill('hello {{missing}}', {})).toThrow(
      /Unresolved template slot \{\{missing\}\}/,
    );
  });
});

describe('transform: consistencyNote', () => {
  it('returns the localized engine-specific note for a known slug', () => {
    const note = consistencyNote(SERVICE_GUIDES.postgres!, GUIDE_COPY);
    expect(note).toContain('MVCC');
  });

  it('falls back to the guide consistencyNote fact for an unknown slug', () => {
    const guide = {
      ...SERVICE_GUIDES.postgres!,
      slug: 'totally-unknown-engine',
      consistencyNote: 'custom fallback note',
    } as ServiceGuide;
    expect(consistencyNote(guide, GUIDE_COPY)).toBe('custom fallback note');
  });
});

describe('transform: humanJoin via useCaseIntro', () => {
  const baseApp = (dbs: string[], slug: string): UseCaseApp =>
    ({
      ...USE_CASES.wordpress!,
      slug,
      appName: 'TestApp',
      detectedDbs: dbs,
      detectedVolumes: ['data'],
    }) as UseCaseApp;

  it('joins two databases with "and"', () => {
    const intro = useCaseIntro(baseApp(['postgres', 'redis'], 'two-db-app'));
    expect(intro).toMatch(/PostgreSQL and Redis/);
  });

  it('joins three or more databases with commas and "and"', () => {
    const intro = useCaseIntro(baseApp(['postgres', 'mysql', 'redis'], 'three-db-app'));
    expect(intro).toMatch(/PostgreSQL, MySQL and Redis/);
  });

  it('maps an unknown db slug through unchanged', () => {
    const intro = useCaseIntro(baseApp(['weirddb', 'redis'], 'unknown-db-app'));
    expect(intro).toContain('weirddb');
  });

  it('handles an app with no detected databases (empty humanJoin)', () => {
    const intro = useCaseIntro(baseApp([], 'no-db-app'));
    expect(intro.length).toBeGreaterThan(0);
  });
});

describe('transform: guideIntro fallbacks', () => {
  it('falls back when liveDataPaths and aliases are empty', () => {
    // Cover the `?? 'the live data directory'` and `?? serviceName` arms.
    for (const guide of Object.values(SERVICE_GUIDES)) {
      const bare = { ...guide, liveDataPaths: [], aliases: [] } as ServiceGuide;
      expect(guideIntro(bare, GUIDE_COPY).length).toBeGreaterThan(0);
    }
  });
});

describe('transform: altIntro lowerFirst empty arm', () => {
  it('handles an empty switchIf when the chosen template lower-cases it', () => {
    // altIntro template index 1 runs switchIf through lowerFirst(); find a slug
    // that deterministically selects that template, then feed an empty switchIf
    // to exercise lowerFirst's empty-string branch.
    const templateSlots = [0, 1, 2, 3];
    let slug = '';
    for (let i = 0; i < 5000; i += 1) {
      if (pick(`altcand${i}`, templateSlots) === 1) {
        slug = `altcand${i}`;
        break;
      }
    }
    expect(slug).not.toBe('');
    const competitor = {
      ...COMPETITORS.backrest!,
      slug,
      switchIf: '',
    } as Competitor;
    expect(typeof altIntro(competitor)).toBe('string');
  });
});

describe('content: slug getters', () => {
  it('getServiceGuide returns a guide for a known slug and undefined otherwise', () => {
    expect(getServiceGuide('postgres')).toBe(SERVICE_GUIDES.postgres);
    expect(getServiceGuide('nope')).toBeUndefined();
  });

  it('getPlatformGuide returns a guide for a known slug and undefined otherwise', () => {
    expect(getPlatformGuide('connect-fleet-agent')).toBe(
      PLATFORM_GUIDES['connect-fleet-agent'],
    );
    expect(getPlatformGuide('nope')).toBeUndefined();
  });

  it('getUseCase returns an app for a known slug and undefined otherwise', () => {
    expect(getUseCase('wordpress')).toBe(USE_CASES.wordpress);
    expect(getUseCase('nope')).toBeUndefined();
  });

  it('getCompetitor returns a competitor for a known slug and undefined otherwise', () => {
    expect(getCompetitor('backrest')).toBe(COMPETITORS.backrest);
    expect(getCompetitor('nope')).toBeUndefined();
  });
});

describe('transform: variance across slugs', () => {
  it('two different service slugs produce different guide intros', () => {
    const a = guideIntro(SERVICE_GUIDES.postgres!, GUIDE_COPY);
    const b = guideIntro(SERVICE_GUIDES.mongodb!, GUIDE_COPY);
    expect(a).not.toBe(b);
  });

  it('the guide corpus is majority-unique (mostly distinct intros)', () => {
    const intros = Object.values(SERVICE_GUIDES).map((guide) =>
      guideIntro(guide, GUIDE_COPY),
    );
    const unique = new Set(intros);
    // Every service names itself in its intro, so all should differ.
    expect(unique.size).toBe(intros.length);
  });

  it('two different use-case slugs produce different intros', () => {
    const a = useCaseIntro(USE_CASES.wordpress!);
    const b = useCaseIntro(USE_CASES.supabase!);
    expect(a).not.toBe(b);
  });

  it('two different competitor slugs produce different alt intros', () => {
    const a = altIntro(COMPETITORS.backrest!);
    const b = altIntro(COMPETITORS.duplicati!);
    expect(a).not.toBe(b);
  });

  it('pick spreads across options for varied slugs', () => {
    const opts = [0, 1, 2, 3, 4];
    const chosen = new Set(SERVICE_GUIDE_SLUGS.map((s) => pick(s, opts)));
    // With 13 slugs over 5 options we expect more than one bucket used.
    expect(chosen.size).toBeGreaterThan(1);
  });
});

describe('content: required fields are present and non-empty', () => {
  it('every service guide has a dump command, consistency data, and step skeletons', () => {
    expect(SERVICE_GUIDE_SLUGS.length).toBeGreaterThanOrEqual(13);
    for (const guide of Object.values(SERVICE_GUIDES)) {
      expect(guide.dumpCmd.trim().length).toBeGreaterThan(0);
      expect(guide.restoreCmd.trim().length).toBeGreaterThan(0);
      expect(guide.consistencyNote.trim().length).toBeGreaterThan(0);
      expect(guide.liveDataPaths.length).toBeGreaterThan(0);
      expect(guide.walkthrough.length).toBeGreaterThanOrEqual(8);
      expect(guide.restoreVerify.length).toBeGreaterThanOrEqual(3);
      expect(guide.lastReviewed).toBe('2026-07');
    }
  });

  it('every platform guide has steps, related links, and no service-URL collision', () => {
    expect(PLATFORM_GUIDE_SLUGS.length).toBeGreaterThanOrEqual(8);
    for (const guide of Object.values(PLATFORM_GUIDES)) {
      expect(guide.steps.length).toBeGreaterThanOrEqual(4);
      expect(guide.relatedPlatformGuides.length).toBeGreaterThan(0);
      expect(guide.relatedServices.length).toBeGreaterThan(0);
      expect(guide.lastReviewed).toBe('2026-07');
      // The backup-<slug>-docker URL shape is reserved for service guides.
      expect(guide.slug).not.toMatch(/^backup-.*-docker$/);
    }
  });

  it('every use-case has a non-empty ordered backup plan', () => {
    expect(USE_CASE_SLUGS.length).toBeGreaterThanOrEqual(18);
    for (const app of Object.values(USE_CASES)) {
      expect(app.backupPlan.length).toBeGreaterThan(0);
      for (const step of app.backupPlan) {
        expect(step.title.trim().length).toBeGreaterThan(0);
        expect(step.detail.trim().length).toBeGreaterThan(0);
      }
      expect(app.detectedDbs.length).toBeGreaterThan(0);
      expect(app.faq.length).toBeGreaterThanOrEqual(3);
      expect(app.restoreNotes.trim().length).toBeGreaterThan(0);
      expect(app.lastReviewed).toBe('2026-07');
    }
  });

  it('every competitor has comparison rows, faq, and positioning', () => {
    expect(Object.keys(COMPETITORS).length).toBeGreaterThanOrEqual(5);
    for (const competitor of Object.values(COMPETITORS)) {
      expect(competitor.comparison.length).toBeGreaterThanOrEqual(5);
      expect(competitor.faq.length).toBeGreaterThanOrEqual(4);
      expect(competitor.strengths.length).toBeGreaterThan(0);
      expect(competitor.weaknesses.length).toBeGreaterThan(0);
      expect(competitor.positioning.trim().length).toBeGreaterThan(0);
      expect(competitor.lastReviewed).toBe('2026-07');
    }
  });
});
