import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusChip, type StatusTone } from './status-chip';

const cases: Array<[StatusTone, string]> = [
  ['success', 'bg-success/10 text-success'],
  ['warning', 'bg-warning/15 text-warning'],
  ['destructive', 'bg-destructive/10 text-destructive'],
  ['muted', 'bg-muted text-muted-foreground'],
];

describe('StatusChip', () => {
  it.each(cases)('maps tone=%s to the semantic tokens (%s)', (tone, expected) => {
    render(<StatusChip tone={tone}>Text</StatusChip>);
    const el = screen.getByText('Text');
    for (const cls of expected.split(' ')) {
      expect(el.classList.contains(cls)).toBe(true);
    }
    expect(el.getAttribute('data-tone')).toBe(tone);
  });

  it('is pill-shaped (SPEC-A3)', () => {
    render(<StatusChip tone="success">Ok</StatusChip>);
    expect(screen.getByText('Ok').classList.contains('rounded-full')).toBe(true);
  });

  it('renders a localized label — never color alone', () => {
    render(<StatusChip tone="destructive">Failed</StatusChip>);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('defaults to muted when tone is unset', () => {
    render(<StatusChip>Neutral</StatusChip>);
    expect(screen.getByText('Neutral').getAttribute('data-tone')).toBe('muted');
  });
});
