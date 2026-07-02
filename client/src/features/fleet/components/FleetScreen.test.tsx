import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { FleetScreen, formatBytes } from './FleetScreen';
import { fleetReducer, type FleetState } from '../store/slice';
import * as thunks from '../store/thunks';
import type { FleetEntry } from '../types';
import { i18n, initI18n } from '@shared/i18n';

// Inert thunks: keep the real static matchers (`.pending`/`.fulfilled`/…) so the
// slice's extraReducers still build, but make every dispatch a no-op. This lets
// the tests drive all UI state purely through preloadedState.
vi.mock('../store/thunks', async () => {
  const actual = await vi.importActual<typeof import('../store/thunks')>('../store/thunks');
  const make = (orig: unknown) =>
    Object.assign(
      vi.fn(() => () => Promise.resolve()),
      orig as object,
    );
  return {
    fetchFleet: make(actual.fetchFleet),
    registerAgent: make(actual.registerAgent),
    lockedReasonFromError: actual.lockedReasonFromError,
  };
});

const mocked = vi.mocked(thunks);

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
});

const baseState = (over: Partial<FleetState> = {}): FleetState => ({
  items: [],
  status: 'succeeded',
  error: null,
  lockedReason: null,
  registerStatus: 'idle',
  registerError: null,
  ...over,
});

const entries: FleetEntry[] = [
  {
    id: 'a1',
    name: 'web-1',
    host: 'vps1.example',
    status: 'online',
    lastSeenAt: '2026-07-01T12:00:00.000Z',
    projectCount: 3,
    totalBytes: 1536,
    snapshotCount: 12,
  },
  {
    id: 'a2',
    name: 'db-1',
    host: 'vps2.example',
    status: 'offline',
    lastSeenAt: null,
    projectCount: 0,
    totalBytes: 0,
    snapshotCount: 0,
  },
];

const renderScreen = (fleet: Partial<FleetState> = {}) => {
  const store = configureStore({
    reducer: { fleet: fleetReducer },
    preloadedState: { fleet: baseState(fleet) },
  });
  render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/fleet']}>
          <FleetScreen />
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
  return store;
};

describe('formatBytes', () => {
  it('renders zero, negative, and non-finite sizes as 0 B', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-42)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('0 B');
  });

  it('scales through the unit ladder', () => {
    expect(formatBytes(512)).toBe('512.0 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 ** 3)).toBe('5.0 GB');
  });

  it('caps at TB instead of overflowing the unit list', () => {
    expect(formatBytes(2 * 1024 ** 4)).toBe('2.0 TB');
    expect(formatBytes(1024 ** 5)).toBe('1024.0 TB');
  });
});

describe('FleetScreen', () => {
  it('dispatches fetchFleet on mount and renders the heading', () => {
    renderScreen();
    expect(mocked.fetchFleet).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Fleet' })).toBeInTheDocument();
  });

  it('shows the loading skeleton while the fleet loads', () => {
    renderScreen({ status: 'loading' });
    expect(screen.getByRole('status')).toHaveTextContent('Loading fleet…');
  });

  it('shows the upgrade prompt when multi-VPS is locked and hides the register action', () => {
    renderScreen({ status: 'failed', error: 'locked', lockedReason: 'multiVpsLocked' });
    expect(screen.getByTestId('fleet-locked')).toBeInTheDocument();
    expect(screen.getByText('Multi-VPS fleet is a Business feature')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View plans' })).toHaveAttribute(
      'href',
      '/billing',
    );
    expect(screen.queryByRole('button', { name: 'Register agent' })).not.toBeInTheDocument();
    // The generic load-error alert must not double up with the locked card.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the load error when fetching fails for other reasons', () => {
    renderScreen({ status: 'failed', error: 'boom' });
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
  });

  it('falls back to a generic load error without a message', () => {
    renderScreen({ status: 'failed', error: null });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the fleet.');
  });

  it('shows the empty state and opens the register dialog from it', () => {
    renderScreen({ status: 'succeeded', items: [] });
    const empty = screen.getByTestId('fleet-empty');
    expect(screen.getByText('No agents yet')).toBeInTheDocument();
    fireEvent.click(within(empty).getByRole('button', { name: 'Register agent' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders the fleet table with statuses, sizes, and last-seen values', () => {
    renderScreen({ status: 'succeeded', items: entries });
    expect(screen.getByRole('table', { name: 'Fleet' })).toBeInTheDocument();
    expect(screen.getByText('web-1')).toBeInTheDocument();
    expect(screen.getByText('vps1.example')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByText('Never')).toBeInTheDocument();
    expect(screen.getByText('1.5 KB')).toBeInTheDocument();
    expect(screen.getByText('0 B')).toBeInTheDocument();
    expect(
      screen.getByText(new Date('2026-07-01T12:00:00.000Z').toLocaleString(i18n.language)),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('fleet-empty')).not.toBeInTheDocument();
  });

  it('opens the register dialog from the header action', () => {
    renderScreen({ status: 'succeeded', items: entries });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Register agent' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Closing via Escape flows back through onClose → setRegisterOpen(false).
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
