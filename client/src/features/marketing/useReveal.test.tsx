import { describe, expect, it, afterEach, vi } from 'vitest';
import { render, act, renderHook } from '@testing-library/react';
import { Reveal, useReveal } from './useReveal';

type IoCb = (entries: Array<{ isIntersecting: boolean }>) => void;

class MockIO {
  static last: MockIO | null = null;
  cb: IoCb;
  disconnected = false;
  observed: unknown = null;
  constructor(cb: IoCb) {
    this.cb = cb;
    MockIO.last = this;
  }
  observe(el: unknown) {
    this.observed = el;
  }
  disconnect() {
    this.disconnected = true;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  MockIO.last = null;
  document.documentElement.classList.remove('mk-js');
});

describe('useReveal', () => {
  it('reveals via IntersectionObserver and disconnects once visible (one-shot)', () => {
    vi.stubGlobal('IntersectionObserver', MockIO);
    const { container } = render(<Reveal index={2}>content</Reveal>);
    const target = container.firstElementChild as HTMLElement;
    expect(target.className).toContain('mk-reveal');
    expect(target.className).not.toContain('is-visible');
    expect(document.documentElement.classList.contains('mk-js')).toBe(true);

    act(() => {
      // A non-intersecting entry first (covers the `if` false arm), then intersecting.
      MockIO.last!.cb([{ isIntersecting: false }]);
      MockIO.last!.cb([{ isIntersecting: true }]);
    });
    expect((container.firstElementChild as HTMLElement).className).toContain('is-visible');
    expect(MockIO.last!.disconnected).toBe(true);
  });

  it('reveals immediately when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { container } = render(
      <Reveal as="section">content</Reveal>,
    );
    expect((container.firstElementChild as HTMLElement).className).toContain('is-visible');
  });

  it('no-ops safely when no element is attached to the ref', () => {
    vi.stubGlobal('IntersectionObserver', MockIO);
    // Hook used without attaching the ref → ref.current stays null (early return).
    const { result } = renderHook(() => useReveal());
    expect(result.current.visible).toBe(false);
    expect(MockIO.last).toBeNull();
  });
});
