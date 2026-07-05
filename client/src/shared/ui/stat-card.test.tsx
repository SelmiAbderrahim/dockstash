import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CheckIcon } from 'lucide-react';
import { StatCard } from './stat-card';
import { IconTile } from './icon-tile';
import { DeltaPill } from './delta-pill';

describe('StatCard', () => {
  it('renders label + value', () => {
    render(<StatCard label="Users" value={1234} />);
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();
  });

  it('renders the trailing slot (DeltaPill Variant C)', () => {
    render(
      <StatCard
        label="MRR"
        value="$4,200"
        caption="than last month"
        trailing={<DeltaPill value={12} formatted="12%" />}
      />,
    );
    expect(screen.getByText('12%')).toBeInTheDocument();
    expect(screen.getByText('than last month')).toBeInTheDocument();
  });

  it('renders the icon slot (Variant B icon tile)', () => {
    render(
      <StatCard
        label="Storage"
        value="18 GB"
        icon={
          <IconTile tone="muted" data-testid="tile">
            <CheckIcon />
          </IconTile>
        }
      />,
    );
    expect(screen.getByTestId('tile')).toBeInTheDocument();
  });

  it('renders a progress bar with clamped aria-valuenow', () => {
    render(
      <StatCard
        label="Storage"
        value="18 GB"
        progress={{ value: 0.5, tone: 'success', label: '50% of cap' }}
      />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('50');
    expect(screen.getByText('50% of cap')).toBeInTheDocument();
  });

  it('clamps progress > 1 to 100%', () => {
    render(
      <StatCard label="X" value="over" progress={{ value: 2, tone: 'destructive' }} />,
    );
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });

  it('clamps progress < 0 to 0%', () => {
    render(<StatCard label="X" value="under" progress={{ value: -1 }} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  it('omits progress + caption when not passed', () => {
    render(<StatCard label="Bare" value={0} />);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('defaults progress tone to primary', () => {
    render(
      <StatCard label="X" value="Y" progress={{ value: 0.3 }} />,
    );
    const bar = screen.getByRole('progressbar');
    const fill = bar.firstElementChild;
    expect(fill?.className).toContain('bg-primary');
  });

  it('supports warning tone on progress', () => {
    render(
      <StatCard label="X" value="Y" progress={{ value: 0.9, tone: 'warning' }} />,
    );
    const fill = screen.getByRole('progressbar').firstElementChild;
    expect(fill?.className).toContain('bg-warning');
  });
});
