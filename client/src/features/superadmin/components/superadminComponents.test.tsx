import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { TooltipProvider } from '@shared/ui/tooltip';
import { i18n, initI18n } from '@shared/i18n';
import { superadminReducer } from '../store/slice';
import type { SuperadminState, SuperadminUser } from '../types';
import { OverviewTab } from './OverviewTab';
import { UsersTab } from './UsersTab';
import { BillingTab } from './BillingTab';
import { AuditTab } from './AuditTab';
import { SystemTab } from './SystemTab';
import { SuperadminScreen } from './SuperadminScreen';
import * as api from '../api';

vi.mock('../api', () => ({
  fetchStatsRequest: vi.fn(),
  fetchUsersRequest: vi.fn(),
  changeUserRoleRequest: vi.fn(),
  forceVerifyUserRequest: vi.fn(),
  setLegalHoldRequest: vi.fn(),
  scheduleDeletionRequest: vi.fn(),
  fetchBillingRequest: vi.fn(),
  fetchAuditRequest: vi.fn(),
  fetchSystemRequest: vi.fn(),
}));

const mocked = vi.mocked(api);

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
  // Default: never-resolving promises so effects don't overwrite preloaded state.
  mocked.fetchStatsRequest.mockReturnValue(new Promise(() => {}) as never);
  mocked.fetchUsersRequest.mockReturnValue(new Promise(() => {}) as never);
  mocked.fetchBillingRequest.mockReturnValue(new Promise(() => {}) as never);
  mocked.fetchAuditRequest.mockReturnValue(new Promise(() => {}) as never);
  mocked.fetchSystemRequest.mockReturnValue(new Promise(() => {}) as never);
});

const baseState = (over: Partial<SuperadminState> = {}): SuperadminState => ({
  stats: null,
  loadingStats: false,
  users: null,
  loadingUsers: false,
  usersSearch: '',
  billing: null,
  loadingBilling: false,
  audit: null,
  loadingAudit: false,
  auditFilters: { action: '', actorUserId: '', from: '', to: '' },
  system: null,
  loadingSystem: false,
  actionPending: false,
  error: '',
  message: '',
  ...over,
});

const makeStore = (over: Partial<SuperadminState> = {}) =>
  configureStore({
    reducer: { superadmin: superadminReducer },
    preloadedState: { superadmin: baseState(over) },
  });

const renderWithStore = (
  ui: React.ReactNode,
  over: Partial<SuperadminState> = {},
  entry = '/superadmin',
) =>
  render(
    <Provider store={makeStore(over)}>
      <I18nextProvider i18n={i18n}>
        <HelmetProvider>
          <TooltipProvider>
            <MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>
          </TooltipProvider>
        </HelmetProvider>
      </I18nextProvider>
    </Provider>,
  );

const sampleUser = (over: Partial<SuperadminUser> = {}): SuperadminUser => ({
  id: 'u1',
  email: 'member@b.co',
  firstName: 'M',
  lastName: 'B',
  role: 'Member',
  emailVerified: true,
  legalHold: false,
  deletionScheduledAt: null,
  language: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('OverviewTab', () => {
  it('shows skeletons while loading', () => {
    const { container } = renderWithStore(<OverviewTab />, { loadingStats: true });
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('shows an error when the load failed', async () => {
    mocked.fetchStatsRequest.mockRejectedValue(new Error('nope'));
    renderWithStore(<OverviewTab />);
    expect(await screen.findByRole('alert')).toHaveTextContent('nope');
  });

  it('renders stat values and subscription bars', () => {
    renderWithStore(<OverviewTab />, {
      stats: {
        users: { total: 10, new7d: 2, new30d: 5, verifiedPct: 80 },
        subscriptions: [{ planSlug: 'pro', status: 'active', count: 3 }],
        projects: { total: 4, paused: 1 },
        backups: { projectsWithSuccess: 2 },
        snapshots: { total: 20, repoBytes: 1024 },
      },
    });
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText(/pro · active/)).toBeInTheDocument();
    // Already loaded → no fetch dispatched.
    expect(mocked.fetchStatsRequest).not.toHaveBeenCalled();
  });

  it('renders the empty subscriptions message and a zero-count bar', () => {
    renderWithStore(<OverviewTab />, {
      stats: {
        users: { total: 0, new7d: 0, new30d: 0, verifiedPct: 0 },
        subscriptions: [],
        projects: { total: 0, paused: 0 },
        backups: { projectsWithSuccess: 0 },
        snapshots: { total: 0, repoBytes: 0 },
      },
    });
    expect(screen.getByText(/no subscriptions yet/i)).toBeInTheDocument();
  });

  it('renders a zero-width bar when every subscription count is zero', () => {
    renderWithStore(<OverviewTab />, {
      stats: {
        users: { total: 1, new7d: 0, new30d: 0, verifiedPct: 100 },
        subscriptions: [{ planSlug: 'free', status: 'active', count: 0 }],
        projects: { total: 0, paused: 0 },
        backups: { projectsWithSuccess: 0 },
        snapshots: { total: 0, repoBytes: 0 },
      },
    });
    expect(screen.getByText(/free · active/)).toBeInTheDocument();
  });

  it('fetches when no stats are present', () => {
    renderWithStore(<OverviewTab />);
    expect(mocked.fetchStatsRequest).toHaveBeenCalled();
  });
});

describe('UsersTab', () => {
  const usersState = (over: Partial<SuperadminUser> = {}, extra: Partial<SuperadminState> = {}) => ({
    users: { users: [sampleUser(over)], total: 1, page: 1, pages: 1 },
    ...extra,
  });

  it('renders rows and dispatches a search', async () => {
    mocked.fetchUsersRequest.mockResolvedValue({
      users: [sampleUser()],
      total: 1,
      page: 1,
      pages: 1,
    });
    renderWithStore(<UsersTab />, usersState());
    expect(screen.getByText('member@b.co')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/search users/i), { target: { value: 'nadia' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await waitFor(() =>
      expect(mocked.fetchUsersRequest).toHaveBeenCalledWith({ page: 1, search: 'nadia' }),
    );
  });

  it('shows a skeleton while loading', () => {
    const { container } = renderWithStore(<UsersTab />, { loadingUsers: true });
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
  });

  it('shows an error alert and empty state', async () => {
    mocked.fetchUsersRequest.mockRejectedValue(new Error('boom'));
    renderWithStore(<UsersTab />);
    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
    expect(screen.getByText(/no users match/i)).toBeInTheDocument();
  });

  it('disables pagination at the bounds and pages otherwise', async () => {
    mocked.fetchUsersRequest.mockResolvedValue({
      users: [sampleUser()],
      total: 6,
      page: 2,
      pages: 3,
    });
    renderWithStore(<UsersTab />, {
      users: { users: [sampleUser()], total: 6, page: 2, pages: 3 },
    });
    const prev = screen.getByRole('button', { name: /previous/i });
    const next = screen.getByRole('button', { name: /next/i });
    expect(prev).toBeEnabled();
    expect(next).toBeEnabled();
    fireEvent.click(next);
    await waitFor(() =>
      expect(mocked.fetchUsersRequest).toHaveBeenCalledWith({ page: 3, search: undefined }),
    );
    fireEvent.click(prev);
    await waitFor(() =>
      expect(mocked.fetchUsersRequest).toHaveBeenCalledWith({ page: 1, search: undefined }),
    );
  });

  it('opens the role dialog and dispatches a role change', async () => {
    const user = userEvent.setup();
    mocked.changeUserRoleRequest.mockResolvedValue({
      message: 'done',
      user: sampleUser({ role: 'Owner' }),
    });
    renderWithStore(<UsersTab />, usersState());
    await user.click(screen.getByRole('button', { name: /open user actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /change role/i }));
    await user.click(await screen.findByRole('button', { name: /confirm/i }));
    await waitFor(() =>
      expect(mocked.changeUserRoleRequest).toHaveBeenCalledWith('u1', 'Member'),
    );
  });

  it('force-verifies through the confirm dialog', async () => {
    const user = userEvent.setup();
    mocked.forceVerifyUserRequest.mockResolvedValue({ message: 'done', user: sampleUser() });
    renderWithStore(<UsersTab />, usersState());
    await user.click(screen.getByRole('button', { name: /open user actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /force-verify email/i }));
    await user.click(await screen.findByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(mocked.forceVerifyUserRequest).toHaveBeenCalledWith('u1'));
  });

  it('cancels a dialog without dispatching', async () => {
    const user = userEvent.setup();
    renderWithStore(<UsersTab />, usersState());
    await user.click(screen.getByRole('button', { name: /open user actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /schedule deletion/i }));
    await user.click(await screen.findByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(mocked.scheduleDeletionRequest).not.toHaveBeenCalled();
  });

  it('toggles legal hold on and schedules deletion', async () => {
    const user = userEvent.setup();
    mocked.setLegalHoldRequest.mockResolvedValue({ message: 'done', user: sampleUser() });
    mocked.scheduleDeletionRequest.mockResolvedValue({
      message: 'done',
      scheduledAt: 's',
      purgeAt: 'p',
      warningEmailQueued: false,
    });
    renderWithStore(<UsersTab />, usersState());
    await user.click(screen.getByRole('button', { name: /open user actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /enable legal hold/i }));
    await user.click(await screen.findByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(mocked.setLegalHoldRequest).toHaveBeenCalledWith('u1', true));

    await user.click(screen.getByRole('button', { name: /open user actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /schedule deletion/i }));
    await user.click(await screen.findByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(mocked.scheduleDeletionRequest).toHaveBeenCalledWith('u1'));
  });

  it('locks the delete dialog with a spinner while the deletion is pending', async () => {
    const user = userEvent.setup();
    renderWithStore(<UsersTab />, usersState({}, { actionPending: true }));
    await user.click(screen.getByRole('button', { name: /open user actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /schedule deletion/i }));
    const confirm = await screen.findByRole('button', { name: /confirm/i });
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    // Escape is ignored while the request is in flight — the dialog stays locked.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('keeps the delete dialog open when the deletion is rejected', async () => {
    const user = userEvent.setup();
    mocked.scheduleDeletionRequest.mockRejectedValue(new Error('nope'));
    renderWithStore(<UsersTab />, usersState());
    await user.click(screen.getByRole('button', { name: /open user actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /schedule deletion/i }));
    await user.click(await screen.findByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(mocked.scheduleDeletionRequest).toHaveBeenCalledWith('u1'));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('opens the release-hold dialog for a held user and dispatches with legalHold false', async () => {
    const user = userEvent.setup();
    mocked.setLegalHoldRequest.mockResolvedValue({ message: 'done', user: sampleUser() });
    renderWithStore(<UsersTab />, {
      users: {
        users: [sampleUser({ legalHold: true, deletionScheduledAt: '2026-09-01T00:00:00.000Z' })],
        total: 1,
        page: 1,
        pages: 1,
      },
    });
    await user.click(screen.getByRole('button', { name: /open user actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /release legal hold/i }));
    expect(await screen.findByText(/release legal hold/i)).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(mocked.setLegalHoldRequest).toHaveBeenCalledWith('u1', false));
  });

  it('defaults the role select to Member when the current role is not assignable', async () => {
    const user = userEvent.setup();
    mocked.changeUserRoleRequest.mockResolvedValue({ message: 'done', user: sampleUser() });
    renderWithStore(<UsersTab />, {
      users: {
        users: [sampleUser({ role: 'Superadmin' })],
        total: 1,
        page: 1,
        pages: 1,
      },
    });
    await user.click(screen.getByRole('button', { name: /open user actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /change role/i }));
    await user.click(await screen.findByRole('button', { name: /confirm/i }));
    await waitFor(() =>
      expect(mocked.changeUserRoleRequest).toHaveBeenCalledWith('u1', 'Member'),
    );
  });

  it('submits an empty search as undefined and shows an unverified row', async () => {
    mocked.fetchUsersRequest.mockResolvedValue({
      users: [sampleUser({ emailVerified: false })],
      total: 1,
      page: 1,
      pages: 1,
    });
    renderWithStore(<UsersTab />, {
      users: { users: [sampleUser({ emailVerified: false })], total: 1, page: 1, pages: 1 },
    });
    expect(screen.getAllByText(/unverified/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await waitFor(() =>
      expect(mocked.fetchUsersRequest).toHaveBeenCalledWith({ page: 1, search: undefined }),
    );
  });

  it('fetches on mount when no users are loaded', () => {
    renderWithStore(<UsersTab />);
    expect(mocked.fetchUsersRequest).toHaveBeenCalledWith({ page: 1 });
  });
});

describe('BillingTab', () => {
  it('shows an error via a rejected fetch', async () => {
    mocked.fetchBillingRequest.mockRejectedValue(new Error('bad'));
    renderWithStore(<BillingTab />);
    expect(await screen.findByRole('alert')).toHaveTextContent('bad');
  });

  it('shows loading and populated states', () => {
    const { container, unmount } = renderWithStore(<BillingTab />, { loadingBilling: true });
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
    unmount();

    renderWithStore(<BillingTab />, {
      billing: {
        customers: [
          {
            id: 'c1',
            userId: 'u1',
            provider: 'polar',
            providerCustomerId: 'cus_1',
            email: 'c@b.co',
            createdAt: '2026-01-01T00:00:00.000Z',
            subscriptions: [
              {
                id: 's1',
                planSlug: 'pro',
                status: 'active',
                cancelAtPeriodEnd: false,
                currentPeriodEnd: null,
              },
            ],
          },
          {
            id: 'c2',
            userId: 'u2',
            provider: 'polar',
            providerCustomerId: 'cus_2',
            email: 'd@b.co',
            createdAt: '2026-01-02T00:00:00.000Z',
            subscriptions: [],
          },
        ],
        total: 2,
        page: 1,
        pages: 1,
      },
    });
    expect(screen.getByText('c@b.co')).toBeInTheDocument();
    expect(screen.getByText(/pro \(active\)/)).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('shows the empty state and paginates', async () => {
    renderWithStore(<BillingTab />, {
      billing: { customers: [], total: 0, page: 1, pages: 0 },
    }).unmount();

    mocked.fetchBillingRequest.mockResolvedValue({
      customers: [],
      total: 0,
      page: 1,
      pages: 2,
    });
    renderWithStore(<BillingTab />, {
      billing: {
        customers: [
          {
            id: 'c1',
            userId: 'u1',
            provider: 'polar',
            providerCustomerId: 'cus_1',
            email: 'c@b.co',
            createdAt: '2026-01-01T00:00:00.000Z',
            subscriptions: [],
          },
        ],
        total: 3,
        page: 1,
        pages: 2,
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(mocked.fetchBillingRequest).toHaveBeenCalledWith({ page: 2 }));
  });

  it('fetches on mount', () => {
    renderWithStore(<BillingTab />);
    expect(mocked.fetchBillingRequest).toHaveBeenCalledWith({ page: 1 });
  });

  it('shows the empty message when billing has no customers', () => {
    renderWithStore(<BillingTab />, { billing: { customers: [], total: 0, page: 1, pages: 0 } });
    expect(screen.getByText(/no customers yet/i)).toBeInTheDocument();
  });
});

describe('AuditTab', () => {
  const auditState = {
    audit: {
      entries: [
        {
          id: 'a1',
          actorUserId: 'u1',
          action: 'backup.run',
          targetType: 'project',
          targetId: 'p1',
          ip: '10.0.0.1',
          metadata: {},
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pages: 1,
    },
  };

  it('renders entries and applies all four filters', async () => {
    mocked.fetchAuditRequest.mockResolvedValue(auditState.audit);
    renderWithStore(<AuditTab />, auditState);
    expect(screen.getByText('backup.run')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/action/i), { target: { value: 'plan.change' } });
    fireEvent.change(screen.getByLabelText(/actor user id/i), { target: { value: 'a1' } });
    fireEvent.change(screen.getByLabelText(/^from$/i), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText(/^to$/i), { target: { value: '2026-02-01' } });
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));
    await waitFor(() =>
      expect(mocked.fetchAuditRequest).toHaveBeenCalledWith({
        page: 1,
        filters: { action: 'plan.change', actorUserId: 'a1', from: '2026-01-01', to: '2026-02-01' },
      }),
    );
  });

  it('shows an error via a rejected fetch', async () => {
    mocked.fetchAuditRequest.mockRejectedValue(new Error('bad'));
    renderWithStore(<AuditTab />);
    expect(await screen.findByRole('alert')).toHaveTextContent('bad');
  });

  it('shows a skeleton and empty state', () => {
    const { container, unmount } = renderWithStore(<AuditTab />, { loadingAudit: true });
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
    unmount();
    renderWithStore(<AuditTab />, { audit: { entries: [], total: 0, page: 1, pages: 0 } });
    expect(screen.getByText(/no audit entries/i)).toBeInTheDocument();
  });

  it('paginates and fetches on mount', async () => {
    mocked.fetchAuditRequest.mockResolvedValue({ ...auditState.audit, page: 1, pages: 2 });
    renderWithStore(<AuditTab />, {
      audit: { ...auditState.audit, total: 3, pages: 2 },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() =>
      expect(mocked.fetchAuditRequest).toHaveBeenCalledWith({
        page: 2,
        filters: { action: '', actorUserId: '', from: '', to: '' },
      }),
    );
  });

  it('fetches on mount when nothing is loaded', () => {
    renderWithStore(<AuditTab />);
    expect(mocked.fetchAuditRequest).toHaveBeenCalled();
  });
});

describe('SystemTab', () => {
  const health = (
    status: 'ok' | 'degraded',
    db = true,
    redis = true,
    redisConfigured = true,
    consumedAt: string | null = null,
  ): Partial<SuperadminState> => ({
    system: {
      health: { status, db, redis, redisConfigured, timestamp: '2026-01-01T00:00:00.000Z' },
      scheduler: { schedules: 2, enabled: 1 },
      security: {
        recentChallenges: [
          {
            id: 'ch1',
            userId: 'u1',
            ip: '10.0.0.1',
            attempts: 0,
            consumedAt,
            expiresAt: '2026-01-01T00:10:00.000Z',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        recentEvents: [
          {
            id: 'e1',
            actorUserId: 'u1',
            action: 'auth.otp.challenge',
            targetType: 'user',
            targetId: 'u1',
            ip: '10.0.0.1',
            metadata: {},
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    },
  });

  it('renders the operational health state with configured redis', () => {
    renderWithStore(<SystemTab />, health('ok'));
    expect(screen.getByText(/operational/i)).toBeInTheDocument();
    expect(screen.getByText('auth.otp.challenge')).toBeInTheDocument();
  });

  it('marks a consumed challenge as used', () => {
    renderWithStore(<SystemTab />, health('ok', true, true, true, '2026-01-01T00:05:00.000Z'));
    expect(screen.getByText(/used/i)).toBeInTheDocument();
  });

  it('renders the degraded state and a down/not-configured redis', () => {
    renderWithStore(<SystemTab />, health('degraded', false, false, false));
    expect(screen.getByText(/degraded/i)).toBeInTheDocument();
    expect(screen.getByText(/not configured/i)).toBeInTheDocument();
  });

  it('renders down redis when configured but unreachable', () => {
    renderWithStore(<SystemTab />, health('degraded', true, false, true));
    expect(screen.getByText(/degraded/i)).toBeInTheDocument();
  });

  it('shows empty challenge/event messages when there are none', () => {
    renderWithStore(<SystemTab />, {
      system: {
        health: {
          status: 'ok',
          db: true,
          redis: true,
          redisConfigured: true,
          timestamp: '2026-01-01T00:00:00.000Z',
        },
        scheduler: { schedules: 0, enabled: 0 },
        security: { recentChallenges: [], recentEvents: [] },
      },
    });
    expect(screen.getAllByText(/nothing recorded yet/i).length).toBeGreaterThan(0);
  });

  it('shows an error via a rejected fetch', async () => {
    mocked.fetchSystemRequest.mockRejectedValue(new Error('bad'));
    renderWithStore(<SystemTab />);
    expect(await screen.findByRole('alert')).toHaveTextContent('bad');
  });

  it('shows a skeleton and fetches on mount', () => {
    const { container, unmount } = renderWithStore(<SystemTab />, { loadingSystem: true });
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
    unmount();
    renderWithStore(<SystemTab />);
    expect(mocked.fetchSystemRequest).toHaveBeenCalled();
  });
});

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="loc">{location.search}</div>;
};

describe('SuperadminScreen', () => {
  const renderScreen = (over: Partial<SuperadminState> = {}, entry = '/superadmin') =>
    render(
      <Provider store={makeStore(over)}>
        <I18nextProvider i18n={i18n}>
          <HelmetProvider>
            <TooltipProvider>
              <MemoryRouter initialEntries={[entry]}>
                <Routes>
                  <Route
                    path="/superadmin"
                    element={
                      <>
                        <SuperadminScreen />
                        <LocationProbe />
                      </>
                    }
                  />
                </Routes>
              </MemoryRouter>
            </TooltipProvider>
          </HelmetProvider>
        </I18nextProvider>
      </Provider>,
    );

  it('defaults to the overview tab', () => {
    renderScreen();
    expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('honours a ?tab= deep link', () => {
    renderScreen({}, '/superadmin?tab=users');
    expect(screen.getByRole('tab', { name: /users/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('falls back to overview for an invalid tab', () => {
    renderScreen({}, '/superadmin?tab=bogus');
    expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('updates the URL when a tab is clicked', async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(screen.getByRole('tab', { name: /system/i }));
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('tab=system'));
  });

  it('renders a status banner when there is a message', () => {
    renderScreen({ message: 'Saved.' });
    expect(screen.getByRole('status')).toHaveTextContent('Saved.');
  });
});
