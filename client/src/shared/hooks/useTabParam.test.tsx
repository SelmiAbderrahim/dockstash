import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useTabParam } from './useTabParam';

const Harness = () => {
  const [tab, setTab] = useTabParam('general', ['general', 'storage', 'security'] as const);
  return (
    <div>
      <span data-testid="tab">{tab}</span>
      <button onClick={() => setTab('storage')}>go-storage</button>
      <button onClick={() => setTab('security')}>go-security</button>
    </div>
  );
};

const LocationProbe = () => {
  const loc = useLocation();
  return <span data-testid="search">{loc.search}</span>;
};

const renderAt = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/x${search}`]}>
      <Routes>
        <Route
          path="/x"
          element={
            <>
              <Harness />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

describe('useTabParam', () => {
  it('falls back to default when ?tab= is missing', () => {
    renderAt('');
    expect(screen.getByTestId('tab').textContent).toBe('general');
  });

  it('reads the active tab from ?tab=', () => {
    renderAt('?tab=storage');
    expect(screen.getByTestId('tab').textContent).toBe('storage');
  });

  it('invalid value falls back to default', () => {
    renderAt('?tab=nope');
    expect(screen.getByTestId('tab').textContent).toBe('general');
  });

  it('setTab writes ?tab= into the URL', () => {
    renderAt('');
    act(() => {
      screen.getByText('go-storage').click();
    });
    expect(screen.getByTestId('search').textContent).toBe('?tab=storage');
    expect(screen.getByTestId('tab').textContent).toBe('storage');
  });
});
