import type { LauncherPosition } from '../types';

const KEY = 'guide:launcher';

/** Keep the launcher reachable: never within 16px of the top, 72px of the bottom. */
export const clampLauncherY = (y: number, viewportHeight: number): number => {
  const max = Math.max(16, viewportHeight - 72);
  return Math.min(Math.max(y, 16), max);
};

export const defaultLauncherPosition = (viewportHeight: number): LauncherPosition => ({
  y: clampLauncherY(Math.round(viewportHeight * 0.6), viewportHeight),
  side: 'end',
});

export const loadLauncherPosition = (viewportHeight: number): LauncherPosition => {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (!raw) return defaultLauncherPosition(viewportHeight);
  try {
    const parsed = JSON.parse(raw) as Partial<LauncherPosition>;
    if (typeof parsed.y !== 'number' || (parsed.side !== 'start' && parsed.side !== 'end')) {
      return defaultLauncherPosition(viewportHeight);
    }
    return { y: clampLauncherY(parsed.y, viewportHeight), side: parsed.side };
  } catch {
    return defaultLauncherPosition(viewportHeight);
  }
};

export const saveLauncherPosition = (position: LauncherPosition): void => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(position));
  } catch {
    // Storage unavailable — position resets next visit.
  }
};
