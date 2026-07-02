import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clampLauncherY,
  defaultLauncherPosition,
  loadLauncherPosition,
  saveLauncherPosition,
} from './launcherStorage';

const KEY = 'guide:launcher';

beforeEach(() => {
  window.localStorage.clear();
});

describe('clampLauncherY', () => {
  it('clamps into the reachable band', () => {
    expect(clampLauncherY(-50, 800)).toBe(16);
    expect(clampLauncherY(400, 800)).toBe(400);
    expect(clampLauncherY(5000, 800)).toBe(800 - 72);
  });

  it('never drops the max below the min on tiny viewports', () => {
    expect(clampLauncherY(500, 40)).toBe(16);
  });
});

describe('defaultLauncherPosition', () => {
  it('sits at 60% height on the end side', () => {
    expect(defaultLauncherPosition(800)).toEqual({ y: 480, side: 'end' });
  });
});

describe('loadLauncherPosition', () => {
  it('returns the default when nothing is stored', () => {
    expect(loadLauncherPosition(800)).toEqual({ y: 480, side: 'end' });
  });

  it('returns the stored position clamped to the viewport', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ y: 5000, side: 'start' }));
    expect(loadLauncherPosition(800)).toEqual({ y: 728, side: 'start' });
  });

  it('falls back on corrupt JSON', () => {
    window.localStorage.setItem(KEY, '{nope');
    expect(loadLauncherPosition(800)).toEqual({ y: 480, side: 'end' });
  });

  it('falls back when the shape is wrong', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ y: 'high', side: 'end' }));
    expect(loadLauncherPosition(800)).toEqual({ y: 480, side: 'end' });
    window.localStorage.setItem(KEY, JSON.stringify({ y: 100, side: 'middle' }));
    expect(loadLauncherPosition(800)).toEqual({ y: 480, side: 'end' });
  });

  it('falls back when storage access throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadLauncherPosition(800)).toEqual({ y: 480, side: 'end' });
    spy.mockRestore();
  });
});

describe('saveLauncherPosition', () => {
  it('persists the position', () => {
    saveLauncherPosition({ y: 123, side: 'start' });
    expect(JSON.parse(window.localStorage.getItem(KEY) as string)).toEqual({
      y: 123,
      side: 'start',
    });
  });

  it('swallows storage errors', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveLauncherPosition({ y: 1, side: 'end' })).not.toThrow();
    spy.mockRestore();
  });
});
