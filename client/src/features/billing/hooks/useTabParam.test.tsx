import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useTabParam } from './useTabParam';

const TABS = ['overview', 'usage'] as const;
type Tab = (typeof TABS)[number];

const Harness = () => {
  const [tab, setTab] = useTabParam<Tab>('overview', TABS);
  const location = useLocation();
  return (
    <div>
      <span data-testid="active">{tab}</span>
      <span data-testid="search">{location.search}</span>
      <button type="button" onClick={() => setTab('usage')}>
        go usage
      </button>
    </div>
  );
};

const renderAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Harness />
    </MemoryRouter>,
  );

describe('useTabParam', () => {
  it('falls back to the default when no tab param is present', () => {
    renderAt('/');
    expect(screen.getByTestId('active').textContent).toBe('overview');
  });

  it('reads a valid tab from the query string', () => {
    renderAt('/?tab=usage');
    expect(screen.getByTestId('active').textContent).toBe('usage');
  });

  it('falls back to the default when the tab param is invalid', () => {
    renderAt('/?tab=bogus');
    expect(screen.getByTestId('active').textContent).toBe('overview');
  });

  it('setTab writes the tab into the query string', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: /go usage/i }));
    expect(screen.getByTestId('active').textContent).toBe('usage');
    expect(screen.getByTestId('search').textContent).toBe('?tab=usage');
  });
});
