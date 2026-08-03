import { describe, expect, it } from 'vitest';
import { GUIDE_TOURS, findTour, sortToursForRoute } from './tours';

describe('GUIDE_TOURS registry', () => {
  it('every tour has an id, i18n keys, a route prefix, and at least one step', () => {
    expect(GUIDE_TOURS.length).toBeGreaterThan(0);
    for (const tour of GUIDE_TOURS) {
      expect(tour.id).toBeTruthy();
      expect(tour.titleKey).toMatch(/^tours\./);
      expect(tour.descriptionKey).toMatch(/^tours\./);
      expect(tour.routePrefix.startsWith('/')).toBe(true);
      expect(tour.steps.length).toBeGreaterThan(0);
      for (const step of tour.steps) {
        expect(step.target).toBeTruthy();
        expect(step.titleKey).toMatch(/^tours\./);
        expect(step.bodyKey).toMatch(/^tours\./);
      }
    }
  });

  it('tour ids are unique', () => {
    const ids = GUIDE_TOURS.map((tour) => tour.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('findTour', () => {
  it('resolves an id, and returns null for null or unknown ids', () => {
    expect(findTour('encryption-password')?.id).toBe('encryption-password');
    expect(findTour(null)).toBeNull();
    expect(findTour('nope')).toBeNull();
  });
});

describe('sortToursForRoute', () => {
  it('puts current-page tours first and sinks completed ones', () => {
    const sorted = sortToursForRoute('/fleet', ['encryption-password']);
    expect(sorted[0]?.id).toBe('explore-fleet');
    expect(sorted[sorted.length - 1]?.id).toBe('encryption-password');
  });

  it('keeps uncompleted current-page tours ahead of completed current-page tours', () => {
    const sorted = sortToursForRoute('/settings', ['configure-storage']);
    const ids = sorted.map((tour) => tour.id);
    expect(ids.indexOf('encryption-password')).toBeLessThan(ids.indexOf('configure-storage'));
    expect(ids.indexOf('retention-policy')).toBeLessThan(ids.indexOf('configure-storage'));
  });

  it('does not mutate the registry', () => {
    const before = GUIDE_TOURS.map((tour) => tour.id);
    sortToursForRoute('/snapshots', []);
    expect(GUIDE_TOURS.map((tour) => tour.id)).toEqual(before);
  });
});
