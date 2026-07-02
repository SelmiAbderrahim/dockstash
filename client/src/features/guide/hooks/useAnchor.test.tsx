import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ANCHOR_TIMEOUT_MS, useAnchor } from './useAnchor';

const Harness = ({ target, active }: { target: string; active: boolean }) => {
  const { status, rect } = useAnchor(target, active);
  return <div data-testid="probe" data-status={status} data-top={rect ? String(rect.top) : ''} />;
};

const probe = () => screen.getByTestId('probe');

const addTarget = (name: string): HTMLElement => {
  const el = document.createElement('div');
  el.setAttribute('data-tour', name);
  document.body.appendChild(el);
  return el;
};

afterEach(() => {
  document.querySelectorAll('[data-tour]').forEach((el) => el.remove());
  vi.useRealTimers();
});

describe('useAnchor', () => {
  it('stays searching while inactive', () => {
    render(<Harness target="x" active={false} />);
    expect(probe().dataset.status).toBe('searching');
  });

  it('finds a pre-existing element and scrolls it into view', () => {
    const el = addTarget('x');
    el.getBoundingClientRect = () => ({ top: 40, left: 10, width: 5, height: 6 }) as DOMRect;
    const scrollSpy = vi.spyOn(el, 'scrollIntoView');
    render(<Harness target="x" active />);
    expect(probe().dataset.status).toBe('found');
    expect(probe().dataset.top).toBe('40');
    expect(scrollSpy).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
  });

  it('respects prefers-reduced-motion', () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    const el = addTarget('x');
    const scrollSpy = vi.spyOn(el, 'scrollIntoView');
    render(<Harness target="x" active />);
    expect(scrollSpy).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' });
    window.matchMedia = original;
  });

  it('waits for the element to appear', async () => {
    render(<Harness target="late" active />);
    expect(probe().dataset.status).toBe('searching');

    // An unrelated mutation must not resolve the anchor.
    const noise = document.createElement('span');
    document.body.appendChild(noise);
    await waitFor(() => expect(probe().dataset.status).toBe('searching'));

    addTarget('late');
    await waitFor(() => expect(probe().dataset.status).toBe('found'));
    noise.remove();
  });

  it('gives up after the timeout', () => {
    vi.useFakeTimers();
    render(<Harness target="never" active />);
    act(() => {
      vi.advanceTimersByTime(ANCHOR_TIMEOUT_MS);
    });
    expect(probe().dataset.status).toBe('missing');
  });

  it('refreshes the rect on scroll and resize', () => {
    const el = addTarget('x');
    let top = 40;
    el.getBoundingClientRect = () => ({ top, left: 0, width: 1, height: 1 }) as DOMRect;
    render(<Harness target="x" active />);
    expect(probe().dataset.top).toBe('40');

    top = 90;
    fireEvent.scroll(window);
    expect(probe().dataset.top).toBe('90');

    top = 120;
    fireEvent(window, new Event('resize'));
    expect(probe().dataset.top).toBe('120');
  });

  it('reports missing when the element is removed mid-step', () => {
    const el = addTarget('x');
    render(<Harness target="x" active />);
    expect(probe().dataset.status).toBe('found');
    el.remove();
    fireEvent.scroll(window);
    expect(probe().dataset.status).toBe('missing');
  });

  it('resets to searching when deactivated', () => {
    addTarget('x');
    const { rerender } = render(<Harness target="x" active />);
    expect(probe().dataset.status).toBe('found');
    rerender(<Harness target="x" active={false} />);
    expect(probe().dataset.status).toBe('searching');
  });
});
