import { describe, expect, it } from 'vitest';
import {
  SPOTLIGHT_PADDING,
  TOOLTIP_GAP,
  VIEWPORT_MARGIN,
  computeArrowPosition,
  computeSpotlightRect,
  computeTooltipPosition,
  resolvePlacement,
  type Rect,
  type Size,
} from './positioning';

const viewport: Size = { width: 1000, height: 800 };
const tooltip: Size = { width: 200, height: 100 };
const centered: Rect = { top: 400, left: 400, width: 100, height: 40 };

describe('computeSpotlightRect', () => {
  it('pads the target rect on all sides', () => {
    const rect = computeSpotlightRect({ top: 10, left: 20, width: 30, height: 40 });
    expect(rect).toEqual({
      top: 10 - SPOTLIGHT_PADDING,
      left: 20 - SPOTLIGHT_PADDING,
      width: 30 + SPOTLIGHT_PADDING * 2,
      height: 40 + SPOTLIGHT_PADDING * 2,
    });
  });

  it('accepts a custom padding', () => {
    const rect = computeSpotlightRect({ top: 10, left: 20, width: 30, height: 40 }, 0);
    expect(rect).toEqual({ top: 10, left: 20, width: 30, height: 40 });
  });
});

describe('resolvePlacement', () => {
  it('keeps a physical placement that fits', () => {
    expect(resolvePlacement('top', false, centered, tooltip, viewport)).toBe('top');
    expect(resolvePlacement('bottom', false, centered, tooltip, viewport)).toBe('bottom');
  });

  it('maps logical start/end through the direction', () => {
    expect(resolvePlacement('start', false, centered, tooltip, viewport)).toBe('left');
    expect(resolvePlacement('start', true, centered, tooltip, viewport)).toBe('right');
    expect(resolvePlacement('end', false, centered, tooltip, viewport)).toBe('right');
    expect(resolvePlacement('end', true, centered, tooltip, viewport)).toBe('left');
  });

  it('auto defaults to bottom', () => {
    expect(resolvePlacement('auto', false, centered, tooltip, viewport)).toBe('bottom');
  });

  it('flips to the opposite side when the preferred side overflows', () => {
    const nearTop: Rect = { top: 10, left: 400, width: 100, height: 40 };
    expect(resolvePlacement('top', false, nearTop, tooltip, viewport)).toBe('bottom');
    const nearBottom: Rect = { top: 760, left: 400, width: 100, height: 40 };
    expect(resolvePlacement('bottom', false, nearBottom, tooltip, viewport)).toBe('top');
    const nearStart: Rect = { top: 400, left: 10, width: 100, height: 40 };
    expect(resolvePlacement('start', false, nearStart, tooltip, viewport)).toBe('right');
    const nearEnd: Rect = { top: 400, left: 900, width: 90, height: 40 };
    expect(resolvePlacement('end', false, nearEnd, tooltip, viewport)).toBe('left');
  });

  it('falls back to bottom when neither side fits', () => {
    const huge: Size = { width: 2000, height: 2000 };
    expect(resolvePlacement('top', false, centered, huge, viewport)).toBe('bottom');
    expect(resolvePlacement('start', false, centered, huge, viewport)).toBe('bottom');
  });
});

describe('computeTooltipPosition', () => {
  it('positions on each side of the target', () => {
    const top = computeTooltipPosition(centered, tooltip, 'top', viewport);
    expect(top).toEqual({ top: 400 - TOOLTIP_GAP - 100, left: 450 - 100 });

    const bottom = computeTooltipPosition(centered, tooltip, 'bottom', viewport);
    expect(bottom).toEqual({ top: 440 + TOOLTIP_GAP, left: 450 - 100 });

    const left = computeTooltipPosition(centered, tooltip, 'left', viewport);
    expect(left).toEqual({ top: 420 - 50, left: 400 - TOOLTIP_GAP - 200 });

    const right = computeTooltipPosition(centered, tooltip, 'right', viewport);
    expect(right).toEqual({ top: 420 - 50, left: 500 + TOOLTIP_GAP });
  });

  it('clamps to the viewport margin', () => {
    const corner: Rect = { top: 0, left: 0, width: 10, height: 10 };
    const pos = computeTooltipPosition(corner, tooltip, 'top', viewport);
    expect(pos.top).toBe(VIEWPORT_MARGIN);
    expect(pos.left).toBe(VIEWPORT_MARGIN);

    const farCorner: Rect = { top: 790, left: 990, width: 10, height: 10 };
    const clamped = computeTooltipPosition(farCorner, tooltip, 'bottom', viewport);
    expect(clamped.top).toBe(viewport.height - tooltip.height - VIEWPORT_MARGIN);
    expect(clamped.left).toBe(viewport.width - tooltip.width - VIEWPORT_MARGIN);
  });

  it('never inverts the clamp range when the tooltip is larger than the viewport', () => {
    const huge: Size = { width: 2000, height: 2000 };
    const pos = computeTooltipPosition(centered, huge, 'bottom', viewport);
    expect(pos.top).toBe(VIEWPORT_MARGIN);
    expect(pos.left).toBe(VIEWPORT_MARGIN);
  });
});

describe('computeArrowPosition', () => {
  it('attaches to the correct tooltip edge for each placement', () => {
    const pos = { top: 300, left: 350 };

    const top = computeArrowPosition(centered, pos, tooltip, 'top');
    expect(top.top).toBe(tooltip.height - 4);

    const bottom = computeArrowPosition(centered, pos, tooltip, 'bottom');
    expect(bottom.top).toBe(-4);

    const left = computeArrowPosition(centered, pos, tooltip, 'left');
    expect(left.left).toBe(tooltip.width - 4);

    const right = computeArrowPosition(centered, pos, tooltip, 'right');
    expect(right.left).toBe(-4);
  });

  it('clamps the arrow inside the tooltip edges', () => {
    const farTarget: Rect = { top: 400, left: 2000, width: 10, height: 10 };
    const clampedHigh = computeArrowPosition(farTarget, { top: 300, left: 350 }, tooltip, 'top');
    expect(clampedHigh.left).toBe(tooltip.width - 16 - 8);

    const nearTarget: Rect = { top: -500, left: -500, width: 10, height: 10 };
    const clampedLow = computeArrowPosition(nearTarget, { top: 300, left: 350 }, tooltip, 'left');
    expect(clampedLow.top).toBe(16);
  });
});
