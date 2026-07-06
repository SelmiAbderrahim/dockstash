import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGuideCopy } from './useGuideCopy';
import {
  loadGuideCopy,
  __resetGuideCopyForTests,
} from './copy-registry';
import { GUIDE_COPY as EN_COPY } from './locale/guides.en';

beforeEach(() => {
  __resetGuideCopyForTests();
});

describe('useGuideCopy', () => {
  it('returns the bundle synchronously when already cached', async () => {
    await loadGuideCopy('en');
    const { result } = renderHook(() => useGuideCopy('en'));
    expect(result.current).toBe(EN_COPY);
  });

  it('returns undefined on a cold entry, then re-renders when loaded', async () => {
    const { result } = renderHook(() => useGuideCopy('en'));
    expect(result.current).toBeUndefined();
    await waitFor(() => {
      expect(result.current).toBe(EN_COPY);
    });
  });

  it('serves the English fallback while a locale loads, then swaps', async () => {
    await loadGuideCopy('en');
    const { result } = renderHook(() => useGuideCopy('fr'));
    // English fallback until the fr chunk lands.
    expect(result.current).toBe(EN_COPY);
    await waitFor(() => {
      expect(result.current).not.toBe(EN_COPY);
      expect(result.current).toBeDefined();
    });
  });

  it('does not re-render after unmount (cancelled load)', async () => {
    const { result, unmount } = renderHook(() => useGuideCopy('en'));
    expect(result.current).toBeUndefined();
    unmount();
    // Let the in-flight load settle; the cancelled guard must swallow it.
    await loadGuideCopy('en');
    expect(result.current).toBeUndefined();
  });
});
