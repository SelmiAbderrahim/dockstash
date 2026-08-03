import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCopyToClipboard } from './useCopyToClipboard';

const setClipboard = (value: unknown) => {
  Object.defineProperty(navigator, 'clipboard', {
    value,
    configurable: true,
    writable: true,
  });
};

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    setClipboard(undefined);
  });

  it('copies via navigator.clipboard when available and flips copied then resets', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    const { result } = renderHook(() => useCopyToClipboard(2000));

    await act(async () => {
      await result.current.copy('secret-key');
    });

    expect(writeText).toHaveBeenCalledWith('secret-key');
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.copied).toBe(false);
  });

  it('stays not-copied when navigator.clipboard.writeText rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    setClipboard({ writeText });
    const { result } = renderHook(() => useCopyToClipboard());

    let ok = true;
    await act(async () => {
      ok = await result.current.copy('x');
    });

    expect(ok).toBe(false);
    expect(result.current.copied).toBe(false);
  });

  it('falls back to execCommand in insecure contexts (no clipboard API)', async () => {
    setClipboard(undefined);
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
      writable: true,
    });
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('fallback-key');
    });

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(result.current.copied).toBe(true);
  });

  it('stays not-copied when execCommand throws', async () => {
    setClipboard(undefined);
    Object.defineProperty(document, 'execCommand', {
      value: vi.fn(() => {
        throw new Error('nope');
      }),
      configurable: true,
      writable: true,
    });
    const { result } = renderHook(() => useCopyToClipboard());

    let ok = true;
    await act(async () => {
      ok = await result.current.copy('x');
    });

    expect(ok).toBe(false);
    expect(result.current.copied).toBe(false);
  });

  it('clears the reset timer on unmount', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { result, unmount } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('a');
    });
    unmount();

    expect(clearSpy).toHaveBeenCalled();
  });

  it('clears a pending reset timer when copying again', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    const { result } = renderHook(() => useCopyToClipboard(2000));

    await act(async () => {
      await result.current.copy('a');
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {
      await result.current.copy('b');
    });
    // Original timer would have fired at 2000ms total; ensure still copied.
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.copied).toBe(true);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.copied).toBe(false);
  });
});
