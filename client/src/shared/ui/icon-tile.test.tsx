import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CheckIcon } from 'lucide-react';
import { IconTile } from './icon-tile';

describe('IconTile', () => {
  it('renders the child icon inside the tinted square', () => {
    render(
      <IconTile tone="success" data-testid="tile">
        <CheckIcon />
      </IconTile>,
    );
    const tile = screen.getByTestId('tile');
    expect(tile.getAttribute('data-tone')).toBe('success');
    expect(tile.classList.contains('bg-success/10')).toBe(true);
    expect(tile.classList.contains('text-success')).toBe(true);
    expect(tile.querySelector('svg')).not.toBeNull();
  });

  it('supports sm and lg sizes', () => {
    const { rerender } = render(
      <IconTile size="sm" data-testid="tile">
        <CheckIcon />
      </IconTile>,
    );
    expect(screen.getByTestId('tile').classList.contains('size-8')).toBe(true);
    rerender(
      <IconTile size="lg" data-testid="tile">
        <CheckIcon />
      </IconTile>,
    );
    expect(screen.getByTestId('tile').classList.contains('size-12')).toBe(true);
  });

  it('is aria-hidden so decoration does not enter the a11y tree', () => {
    render(
      <IconTile data-testid="tile">
        <CheckIcon />
      </IconTile>,
    );
    expect(screen.getByTestId('tile').getAttribute('aria-hidden')).toBe('true');
  });
});
