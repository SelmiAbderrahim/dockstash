import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeltaPill } from './delta-pill';

const goodness = (label: string) =>
  screen.getByText(label).closest('[data-slot="delta-pill"]')?.getAttribute('data-goodness');

describe('DeltaPill', () => {
  it('positive delta is GOOD by default', () => {
    render(<DeltaPill value={12} formatted="12%" />);
    expect(goodness('12%')).toBe('good');
    expect(screen.getByText('+')).toBeInTheDocument();
  });

  it('negative delta is BAD by default', () => {
    render(<DeltaPill value={-4} formatted="4%" />);
    expect(goodness('4%')).toBe('bad');
    expect(screen.getByText('−')).toBeInTheDocument();
  });

  it('inverts semantics for cost/failure metrics (decrease is good)', () => {
    render(<DeltaPill value={-3} formatted="$3" invert />);
    expect(goodness('$3')).toBe('good');
  });

  it('inverted positive delta becomes BAD', () => {
    render(<DeltaPill value={5} formatted="5" invert />);
    expect(goodness('5')).toBe('bad');
  });

  it('zero delta is neutral', () => {
    render(<DeltaPill value={0} formatted="0" />);
    expect(goodness('0')).toBe('neutral');
    expect(screen.getByText('±')).toBeInTheDocument();
  });

  it('renders the pre-formatted number as passed', () => {
    render(<DeltaPill value={1} formatted="1,234" />);
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });
});
