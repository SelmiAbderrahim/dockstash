import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { FleetScreen, formatBytes } from './FleetScreen';
import { guideReducer } from '@features/guide';
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
    rotateAgentKey: make(actual.rotateAgentKey),
    // deleteAgent resolves to a real fulfilled action so the component's
    // `deleteAgent.fulfilled.match(res)` success check (which closes the dialog)
    // is exercised. Per-test overrides can resolve a rejected action instead.
    deleteAgent: Object.assign(
      vi.fn((id: string) => () => Promise.resolve(actual.deleteAgent.fulfilled(id, 'req', id))),
      actual.deleteAgent,
    ),
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
  rotateStatus: 'idle',
  rotateError: null,
  deleteStatus: 'idle',
  deleteError: null,
  ...over,
});

const entries: FleetEntry[] = [
  {
    id: 'a1',
    name: 'web-1',
    host: 'vps1.example',
    status: 'online',
    lastSeenAt: '2026-07-01T12:00:00.000Z',
    agentVersion: '0.2.0',
    outdated: false,
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
    agentVersion: '0.1.0',
    outdated: true,
    projectCount: 0,
    totalBytes: 0,
    snapshotCount: 0,
  },
];

interface GuideOver {
  activeTourId?: string | null;
  stepIndex?: number;
}

const guideState = (over: GuideOver = {}) => ({
  enabled: true,
  saving: false,
  error: null,
  panelOpen: false,
  activeTourId: null,
  stepIndex: 0,
  ...over,
});

const renderScreen = (fleet: Partial<FleetState> = {}, guide: GuideOver = {}) => {
  const store = configureStore({
    reducer: { fleet: fleetReducer, guide: guideReducer },
    preloadedState: { fleet: baseState(fleet), guide: guideState(guide) },
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

  it('auto-opens the register dialog when the guide tour targets a dialog field', () => {
    // explore-fleet step index 2 is the `agent-name-input` step, which lives
    // inside the dialog — the screen must open it so the anchor can mount.
    renderScreen(
      { status: 'succeeded', items: entries },
      { activeTourId: 'explore-fleet', stepIndex: 2 },
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('leaves the dialog closed when the guide tour targets an on-page element', () => {
    // step index 1 is the `fleet-register-button` step — not a dialog anchor.
    renderScreen(
      { status: 'succeeded', items: entries },
      { activeTourId: 'explore-fleet', stepIndex: 1 },
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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

describe('FleetScreen background polling', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls fetchFleet silently every 30s and clears the interval on unmount', () => {
    vi.useFakeTimers();
    const store = configureStore({
      reducer: { fleet: fleetReducer, guide: guideReducer },
      preloadedState: {
        fleet: baseState({ status: 'succeeded', items: entries }),
        guide: guideState(),
      },
    });
    const { unmount } = render(
      <Provider store={store}>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={['/fleet']}>
            <FleetScreen />
          </MemoryRouter>
        </I18nextProvider>
      </Provider>,
    );

    expect(mocked.fetchFleet).toHaveBeenCalledTimes(1);
    expect(mocked.fetchFleet).toHaveBeenNthCalledWith(1);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(mocked.fetchFleet).toHaveBeenCalledTimes(2);
    expect(mocked.fetchFleet).toHaveBeenLastCalledWith({ silent: true });
    // The silent tick must never flash the loading skeleton.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Fleet' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(mocked.fetchFleet).toHaveBeenCalledTimes(4);

    unmount();

    // No further ticks are dispatched once unmounted — the interval was cleared.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(mocked.fetchFleet).toHaveBeenCalledTimes(4);
  });
});

describe('FleetScreen row actions', () => {
  it('shows the row actions in the dropdown menu', async () => {
    const user = userEvent.setup();
    renderScreen({ status: 'succeeded', items: entries });
    await user.click(screen.getAllByRole('button', { name: 'Agent actions' })[0]!);
    expect(await screen.findByRole('menuitem', { name: 'Setup instructions' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Rotate key' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Update agent' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Remove agent' })).toBeInTheDocument();
  });

  it('opens the update dialog with the pull/recreate command from the update action', async () => {
    const user = userEvent.setup();
    renderScreen({ status: 'succeeded', items: entries });
    await user.click(screen.getAllByRole('button', { name: 'Agent actions' })[0]!);
    await user.click(await screen.findByRole('menuitem', { name: 'Update agent' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText(/docker compose -f docker-compose\.agent\.yml pull/),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the setup dialog from the setup action and closes it via onClose', async () => {
    const user = userEvent.setup();
    renderScreen({ status: 'succeeded', items: entries });
    await user.click(screen.getAllByRole('button', { name: 'Agent actions' })[0]!);
    await user.click(await screen.findByRole('menuitem', { name: 'Setup instructions' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Agent setup')).toBeInTheDocument();

    // Escape flows through AgentSetupDialog's onClose → setSetupAgent(null).
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the setup dialog from the rotate action too (same dialog handles rotation)', async () => {
    const user = userEvent.setup();
    renderScreen({ status: 'succeeded', items: entries });
    await user.click(screen.getAllByRole('button', { name: 'Agent actions' })[0]!);
    await user.click(await screen.findByRole('menuitem', { name: 'Rotate key' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Agent setup')).toBeInTheDocument();
  });

  it('confirms removal, dispatching deleteAgent for the selected agent', async () => {
    const user = userEvent.setup();
    renderScreen({ status: 'succeeded', items: entries });
    await user.click(screen.getAllByRole('button', { name: 'Agent actions' })[0]!);
    await user.click(await screen.findByRole('menuitem', { name: 'Remove agent' }));
    expect(
      screen.getByText(
        'Remove "web-1" from your fleet? Its projects fall back to local backups and any queued jobs are cancelled.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(mocked.deleteAgent).toHaveBeenCalledWith('a1');
    // The dialog closes only once the delete resolves successfully.
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('locks the remove dialog with a spinner while the delete is in flight', async () => {
    const user = userEvent.setup();
    renderScreen({ status: 'succeeded', items: entries, deleteStatus: 'loading' });
    await user.click(screen.getAllByRole('button', { name: 'Agent actions' })[0]!);
    await user.click(await screen.findByRole('menuitem', { name: 'Remove agent' }));
    const confirm = screen.getByRole('button', { name: 'Remove' });
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    // Escape is ignored while the delete is in flight — the dialog stays locked.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('keeps the dialog open and surfaces the error when the delete fails', async () => {
    const user = userEvent.setup();
    renderScreen({
      status: 'succeeded',
      items: entries,
      deleteStatus: 'failed',
      deleteError: 'Could not remove the agent.',
    });
    await user.click(screen.getAllByRole('button', { name: 'Agent actions' })[0]!);
    await user.click(await screen.findByRole('menuitem', { name: 'Remove agent' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Could not remove the agent.');
  });

  it('does not close the dialog when the delete is rejected', async () => {
    const user = userEvent.setup();
    mocked.deleteAgent.mockReturnValueOnce(
      (() =>
        Promise.resolve(thunks.deleteAgent.rejected(new Error('x'), 'req', 'a1'))) as never,
    );
    renderScreen({ status: 'succeeded', items: entries });
    await user.click(screen.getAllByRole('button', { name: 'Agent actions' })[0]!);
    await user.click(await screen.findByRole('menuitem', { name: 'Remove agent' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(mocked.deleteAgent).toHaveBeenCalledWith('a1'));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('cancel on the remove confirmation does not dispatch deleteAgent', async () => {
    const user = userEvent.setup();
    renderScreen({ status: 'succeeded', items: entries });
    await user.click(screen.getAllByRole('button', { name: 'Agent actions' })[0]!);
    await user.click(await screen.findByRole('menuitem', { name: 'Remove agent' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mocked.deleteAgent).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
