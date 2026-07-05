import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CheckIcon } from 'lucide-react';
import { StatChip } from './stat-chip';

describe('StatChip', () => {
  it('renders value + label + tone tint', () => {
    render(<StatChip tone="success" value={42} label="Succeeded" />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Succeeded')).toBeInTheDocument();
    const root = screen.getByText('42').closest('[data-slot="stat-chip"]');
    expect(root?.getAttribute('data-tone')).toBe('success');
    expect(root?.classList.contains('bg-success/10')).toBe(true);
  });

  it('renders the trailing icon inside a token circle when provided', () => {
    render(
      <StatChip tone="warning" value={3} label="Pending" icon={<CheckIcon />} />,
    );
    const root = screen.getByText('3').closest('[data-slot="stat-chip"]');
    const iconWrap = root?.querySelector('span[aria-hidden="true"]');
    expect(iconWrap).not.toBeNull();
    expect(iconWrap?.querySelector('svg')).not.toBeNull();
  });

  it('omits the icon slot when none is passed', () => {
    render(<StatChip value={0} label="None" />);
    const root = screen.getByText('0').closest('[data-slot="stat-chip"]');
    expect(root?.querySelector('span[aria-hidden="true"]')).toBeNull();
  });

  it('defaults to muted tone', () => {
    render(<StatChip value={1} label="Neutral" />);
    expect(
      screen.getByText('1').closest('[data-slot="stat-chip"]')?.getAttribute('data-tone'),
    ).toBe('muted');
  });

  it('destructive tone paints the destructive token', () => {
    render(<StatChip tone="destructive" value={7} label="Failed" />);
    expect(
      screen
        .getByText('7')
        .closest('[data-slot="stat-chip"]')
        ?.classList.contains('bg-destructive/10'),
    ).toBe(true);
  });
});
