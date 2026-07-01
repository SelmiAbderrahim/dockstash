import { describe, it, expect } from 'vitest';
import { SERVICE_GUIDES, SERVICE_GUIDE_SLUGS } from './guides';
import { USE_CASES, USE_CASE_SLUGS } from './use-cases';
import { COMPETITORS } from './competitors';
import { guideIntro, useCaseIntro, altIntro, hashSlug, pick } from './transform';

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
