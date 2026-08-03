import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useDraggable } from './useDraggable';

const Harness = ({ onActivate }: { onActivate: () => void }) => {
  const { position, dragging, handlers } = useDraggable(onActivate);
  return (
    <button
      type="button"
      data-testid="drag"
      data-side={position.side}
      data-y={position.y}
      data-dragging={String(dragging)}
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
    />
  );
};

const el = () => screen.getByTestId('drag');

// jsdom has no PointerEvent; a MouseEvent with the pointer type name carries
// real clientX/clientY through React's synthetic pointer handlers.
const pointer = (type: 'pointerdown' | 'pointermove' | 'pointerup', x: number, y: number) =>
  new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  document.dir = '';
});

describe('useDraggable', () => {
  it('treats a press without movement as a click', () => {
    const onActivate = vi.fn();
    render(<Harness onActivate={onActivate} />);
    fireEvent(el(), pointer('pointerdown', 500, 300));
    fireEvent(el(), pointer('pointerup', 500, 300));
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem('guide:launcher')).toBeNull();
  });

  it('ignores movement below the drag threshold', () => {
    const onActivate = vi.fn();
    render(<Harness onActivate={onActivate} />);
    fireEvent(el(), pointer('pointerdown', 500, 300));
    fireEvent(el(), pointer('pointermove', 502, 301));
    expect(el().dataset.dragging).toBe('false');
    fireEvent(el(), pointer('pointerup', 502, 301));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('drags vertically, snaps to the end edge, and persists', () => {
    const onActivate = vi.fn();
    render(<Harness onActivate={onActivate} />);
    const startY = Number(el().dataset.y);

    fireEvent(el(), pointer('pointerdown', 500, 300));
    fireEvent(el(), pointer('pointermove', 500, 200));
    expect(el().dataset.dragging).toBe('true');
    expect(Number(el().dataset.y)).toBe(startY - 100);
    // A follow-up move skips the threshold check once dragging.
    fireEvent(el(), pointer('pointermove', 500, 190));
    expect(Number(el().dataset.y)).toBe(startY - 110);

    fireEvent(el(), pointer('pointerup', 900, 190));
    expect(onActivate).not.toHaveBeenCalled();
    expect(el().dataset.side).toBe('end');
    expect(el().dataset.dragging).toBe('false');
    expect(JSON.parse(window.localStorage.getItem('guide:launcher') as string)).toMatchObject({
      side: 'end',
    });
  });

  it('snaps to the start edge when released on the near half', () => {
    render(<Harness onActivate={vi.fn()} />);
    fireEvent(el(), pointer('pointerdown', 500, 300));
    fireEvent(el(), pointer('pointermove', 200, 350));
    fireEvent(el(), pointer('pointerup', 200, 350));
    expect(el().dataset.side).toBe('start');
  });

  it('maps the physical edge through RTL', () => {
    document.dir = 'rtl';
    render(<Harness onActivate={vi.fn()} />);
    fireEvent(el(), pointer('pointerdown', 500, 300));
    fireEvent(el(), pointer('pointermove', 900, 350));
    fireEvent(el(), pointer('pointerup', 900, 350));
    // Physical right half in RTL is the logical start side.
    expect(el().dataset.side).toBe('start');
  });

  it('ignores stray moves and releases without a prior press', () => {
    const onActivate = vi.fn();
    render(<Harness onActivate={onActivate} />);
    fireEvent(el(), pointer('pointermove', 900, 100));
    fireEvent(el(), pointer('pointerup', 900, 100));
    expect(onActivate).not.toHaveBeenCalled();
    expect(el().dataset.dragging).toBe('false');
  });

  it('re-clamps the position when the viewport shrinks', () => {
    render(<Harness onActivate={vi.fn()} />);
    const original = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', { value: 200, configurable: true });
    fireEvent(window, new Event('resize'));
    expect(Number(el().dataset.y)).toBe(200 - 72);
    Object.defineProperty(window, 'innerHeight', { value: original, configurable: true });
  });
});
