import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearResume,
  hasSeenNudge,
  isCompleted,
  loadProgress,
  markCompleted,
  markNudgeSeen,
  saveResume,
} from './progressStorage';

const KEY = 'guide:progress';

beforeEach(() => {
  window.localStorage.clear();
});

describe('loadProgress', () => {
  it('returns empty progress when nothing is stored', () => {
    expect(loadProgress()).toEqual({ completed: [], resume: null });
  });

  it('round-trips completed and resume', () => {
    markCompleted('a');
    saveResume({ tourId: 'b', stepIndex: 2 });
    expect(loadProgress()).toEqual({ completed: ['a'], resume: { tourId: 'b', stepIndex: 2 } });
  });

  it('recovers from corrupt JSON', () => {
    window.localStorage.setItem(KEY, '{nope');
    expect(loadProgress()).toEqual({ completed: [], resume: null });
  });

  it('sanitizes foreign shapes', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ completed: ['ok', 42], resume: { tourId: 7 } }),
    );
    expect(loadProgress()).toEqual({ completed: ['ok'], resume: null });

    window.localStorage.setItem(KEY, JSON.stringify({ completed: 'nope', resume: null }));
    expect(loadProgress()).toEqual({ completed: [], resume: null });
  });

  it('coerces a malformed resume stepIndex to 0', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ completed: [], resume: { tourId: 'a', stepIndex: 'x' } }),
    );
    expect(loadProgress()).toEqual({ completed: [], resume: { tourId: 'a', stepIndex: 0 } });
  });

  it('returns empty when storage reads throw', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadProgress()).toEqual({ completed: [], resume: null });
    spy.mockRestore();
  });
});

describe('markCompleted / isCompleted', () => {
  it('adds a tour once', () => {
    markCompleted('a');
    markCompleted('a');
    expect(loadProgress().completed).toEqual(['a']);
    expect(isCompleted('a')).toBe(true);
    expect(isCompleted('b')).toBe(false);
  });

  it('clears a matching resume bookmark and keeps a foreign one', () => {
    saveResume({ tourId: 'a', stepIndex: 1 });
    markCompleted('a');
    expect(loadProgress().resume).toBeNull();

    saveResume({ tourId: 'b', stepIndex: 1 });
    markCompleted('c');
    expect(loadProgress().resume).toEqual({ tourId: 'b', stepIndex: 1 });
  });

  it('swallows storage write errors', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => markCompleted('a')).not.toThrow();
    spy.mockRestore();
  });
});

describe('resume bookkeeping', () => {
  it('saves and clears the resume point', () => {
    saveResume({ tourId: 'a', stepIndex: 3 });
    expect(loadProgress().resume).toEqual({ tourId: 'a', stepIndex: 3 });
    clearResume();
    expect(loadProgress().resume).toBeNull();
  });
});

describe('nudge flag', () => {
  it('flips once and stays', () => {
    expect(hasSeenNudge()).toBe(false);
    markNudgeSeen();
    expect(hasSeenNudge()).toBe(true);
  });
});
