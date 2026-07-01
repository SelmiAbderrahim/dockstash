import { describe, it, expect } from 'vitest';
import { SERVICE_GUIDES, SERVICE_GUIDE_SLUGS, getServiceGuide } from './guides';
import { USE_CASES, USE_CASE_SLUGS, getUseCase } from './use-cases';
import { COMPETITORS, getCompetitor } from './competitors';
import { guideIntro, useCaseIntro, altIntro, hashSlug, pick, consistencyNote } from './transform';
import type { Competitor, ServiceGuide, UseCaseApp } from '../types';

describe('transform: determinism', () => {
  it('guideIntro returns the same output for the same slug across calls', () => {
    for (const guide of Object.values(SERVICE_GUIDES)) {
      const first = guideIntro(guide);
      const second = guideIntro(guide);
      const third = guideIntro(guide);
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

describe('transform: consistencyNote', () => {
  it('returns the engine-specific note for a known slug', () => {
    const note = consistencyNote(SERVICE_GUIDES.postgres!);
    expect(note).toContain('MVCC');
  });

  it('falls back to the guide consistencyNote for an unknown slug', () => {
    const guide = {
      ...SERVICE_GUIDES.postgres!,
      slug: 'totally-unknown-engine',
      consistencyNote: 'custom fallback note',
    } as ServiceGuide;
    expect(consistencyNote(guide)).toBe('custom fallback note');
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
    // Cover the `?? 'the live data directory'` and `?? name` arms.
    for (const guide of Object.values(SERVICE_GUIDES)) {
      const bare = { ...guide, liveDataPaths: [], aliases: [] } as ServiceGuide;
      expect(guideIntro(bare).length).toBeGreaterThan(0);
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
    const a = guideIntro(SERVICE_GUIDES.postgres!);
    const b = guideIntro(SERVICE_GUIDES.mongodb!);
    expect(a).not.toBe(b);
  });

  it('the guide corpus is majority-unique (mostly distinct intros)', () => {
    const intros = Object.values(SERVICE_GUIDES).map(guideIntro);
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
  it('every service guide has a dump command and consistency data', () => {
    expect(SERVICE_GUIDE_SLUGS.length).toBeGreaterThanOrEqual(13);
    for (const guide of Object.values(SERVICE_GUIDES)) {
      expect(guide.dumpCmd.trim().length).toBeGreaterThan(0);
      expect(guide.restoreCmd.trim().length).toBeGreaterThan(0);
      expect(guide.consistencyNote.trim().length).toBeGreaterThan(0);
      expect(guide.liveDataPaths.length).toBeGreaterThan(0);
      expect(guide.gotchas.length).toBeGreaterThan(0);
      expect(guide.faq.length).toBeGreaterThanOrEqual(3);
      expect(guide.lastReviewed).toBe('2026-07');
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
