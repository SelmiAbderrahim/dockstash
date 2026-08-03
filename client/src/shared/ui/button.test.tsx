import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('renders a native button with cursor semantics', () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn.className).toContain('cursor-pointer');
    expect(btn.className).toContain('disabled:cursor-not-allowed');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Hi</Button>);
    expect(ref.current?.tagName).toBe('BUTTON');
  });

  it('shows the spinner and disables when loading, without hiding the label', () => {
    render(<Button loading>Saving</Button>);
    const btn = screen.getByRole('button', { name: /saving/i });
    expect(btn).toBeDisabled();
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.getAttribute('data-loading')).toBe('');
    // spinner is aria-hidden so screen readers hear the accessible name
    const spinner = btn.querySelector('[data-slot="spinner"]');
    expect(spinner).not.toBeNull();
    expect(spinner?.getAttribute('aria-hidden')).toBe('true');
  });

  it('restores to enabled when loading flips back (success OR error path)', () => {
    const { rerender } = render(<Button loading>Save</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    rerender(<Button loading={false}>Save</Button>);
    expect(screen.getByRole('button')).not.toBeDisabled();
    expect(screen.getByRole('button').getAttribute('aria-busy')).toBeNull();
    expect(screen.getByRole('button').querySelector('[data-slot="spinner"]')).toBeNull();
  });

  it('guards against double-submit while loading', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Go
      </Button>,
    );
    const btn = screen.getByRole('button');
    await user.click(btn);
    await user.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('fires exactly once for a normal click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not render an in-button spinner when asChild is used', () => {
    render(
      <Button asChild loading>
        <a href="/x">Link</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Link' });
    expect(link.querySelector('[data-slot="spinner"]')).toBeNull();
  });

  it('honors explicit disabled prop irrespective of loading', () => {
    render(<Button disabled>Off</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('exposes a link variant for inline anchors', () => {
    render(<Button variant="link">More</Button>);
    const btn = screen.getByRole('button', { name: 'More' });
    expect(btn.className).toContain('underline-offset-4');
  });
});
