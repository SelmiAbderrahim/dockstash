import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from './spinner';

describe('Spinner', () => {
  it('renders with default aria-label', () => {
    render(<Spinner />);
    const node = screen.getByRole('status');
    expect(node).toHaveAttribute('aria-label', 'Loading');
    expect(node.classList.contains('animate-spin')).toBe(true);
  });

  it('accepts a custom aria-label', () => {
    render(<Spinner aria-label="Saving" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Saving');
  });

  it('merges extra className', () => {
    render(<Spinner className="size-6 text-primary" />);
    const node = screen.getByRole('status');
    expect(node.classList.contains('size-6')).toBe(true);
    expect(node.classList.contains('text-primary')).toBe(true);
  });
});
