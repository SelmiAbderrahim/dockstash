import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { HealthScreen } from './HealthScreen';
import { healthReducer } from '../store/slice';
import { fetchAlerts, fetchHealthOverview } from '../store/thunks';
import { i18n, initI18n } from '@shared/i18n';
import { healthRoutes } from '../routes';
import * as publicApi from '../index';
import * as api from '../api';
import type { AlertItem, HealthOverview, ProjectHealthEntry } from '../types';

vi.mock('../api', () => ({
  fetchOverviewRequest: vi.fn(),
  fetchAlertsRequest: vi.fn(),
  markAlertsReadRequest: vi.fn(),
}));

const mocked = vi.mocked(api);

const makeEntry = (over: Partial<ProjectHealthEntry> = {}): ProjectHealthEntry => ({
  projectId: 'p1',
  name: 'my-project',
  paused: false,
  status: 'healthy',
  reasons: [],
  lastStatus: 'success',
  lastSuccessAt: '2024-01-01T00:00:00Z',
  lastDrillStatus: null,
  lastCheckStatus: null,
  agentStatus: null,
  hasEnabledSchedule: true,
  ...over,
});

const makeOverview = (over: Partial<HealthOverview> = {}): HealthOverview => ({
  status: 'healthy',
  projects: [],
  unreadAlerts: 0,
  ...over,
});

const makeAlert = (over: Partial<AlertItem> = {}): AlertItem => ({
  id: 'a1',
  projectId: 'p1',
  projectName: 'my-project',
  kind: 'backup',
  severity: 'warning',
  error: 'restic exited 1',
  read: false,
  createdAt: '2024-01-01T00:00:00Z',
  ...over,
});

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
  mocked.fetchOverviewRequest.mockResolvedValue(makeOverview());
  mocked.fetchAlertsRequest.mockResolvedValue([]);
});

const renderScreen = (entry = '/health') => {
  const store = configureStore({ reducer: { health: healthReducer } });
  const utils = render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[entry]}>
          <HealthScreen />
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
  return { ...utils, store };
};

describe('health public API', () => {
  it('exposes the /health route wrapped in RequireVerified', () => {
    expect(healthRoutes).toHaveLength(1);
    expect(healthRoutes[0]?.path).toBe('health');
    expect(healthRoutes[0]?.element).toBeTruthy();
  });

  it('re-exports routes, reducer and screen from index', () => {
    expect(publicApi.healthRoutes).toBe(healthRoutes);
    expect(publicApi.healthReducer).toBe(healthReducer);
    expect(publicApi.HealthScreen).toBe(HealthScreen);
  });
});

describe('HealthScreen — overview tab', () => {
  it('shows a loading indicator while the overview is pending', () => {
    mocked.fetchOverviewRequest.mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows an error alert with the error text', async () => {
    mocked.fetchOverviewRequest.mockRejectedValue(new Error('kaboom'));
    renderScreen();
    expect(await screen.findByRole('alert')).toHaveTextContent('kaboom');
  });

  it('falls back to the default error message when error is cleared', async () => {
    mocked.fetchOverviewRequest.mockRejectedValue(new Error('kaboom'));
    const { store } = renderScreen();
    await screen.findByRole('alert');
    // A later alerts refetch clears the shared error while status stays failed.
    act(() => {
      store.dispatch({ type: fetchAlerts.pending.type });
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load health data.');
  });

  it('renders the fleet banner and one card per project with status chips', async () => {
    mocked.fetchOverviewRequest.mockResolvedValue(
      makeOverview({
        status: 'critical',
        projects: [
          makeEntry({ projectId: 'p1', name: 'alpha', status: 'healthy', agentStatus: 'online' }),
          makeEntry({
            projectId: 'p2',
            name: 'beta',
            status: 'degraded',
            reasons: ['backupStale', 'noSchedule'],
            lastSuccessAt: null,
            agentStatus: 'offline',
            paused: true,
          }),
          makeEntry({
            projectId: 'p3',
            name: 'gamma',
            status: 'critical',
            reasons: ['backupFailed'],
          }),
        ],
      }),
    );
    renderScreen();
    expect(await screen.findByTestId('health-banner')).toHaveTextContent(
      'At least one project has a critical problem.',
    );
    // Status chips: one Healthy, one Degraded, two Critical (banner + card).
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('Degraded')).toBeInTheDocument();
    expect(screen.getAllByText('Critical')).toHaveLength(2);
    // Localized reasons.
    expect(screen.getByText('Last successful backup is stale')).toBeInTheDocument();
    expect(screen.getByText('No backup schedule enabled')).toBeInTheDocument();
    expect(screen.getByText('Last backup failed')).toBeInTheDocument();
    // Last success: alpha has a localized date, beta shows "Never".
    const alpha = screen.getByTestId('health-project-p1');
    expect(alpha).toHaveTextContent(new Date('2024-01-01T00:00:00Z').toLocaleString('en'));
    expect(screen.getByTestId('health-project-p2')).toHaveTextContent('Never');
    // Agent status only rendered when non-null.
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByTestId('health-project-p3')).not.toHaveTextContent('Agent:');
    // Paused badge.
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('falls back to the overview tab for an invalid ?tab= value', async () => {
    renderScreen('/health?tab=bogus');
    const overviewTab = await screen.findByRole('tab', { name: 'Overview' });
    expect(overviewTab).toHaveAttribute('aria-selected', 'true');
  });
});

describe('HealthScreen — alerts tab', () => {
  it('renders alerts with kind, severity, error, date and unread emphasis', async () => {
    mocked.fetchOverviewRequest.mockResolvedValue(makeOverview({ unreadAlerts: 1 }));
    mocked.fetchAlertsRequest.mockResolvedValue([
      makeAlert({ id: 'a1', kind: 'backup', severity: 'warning', read: false }),
      makeAlert({
        id: 'a2',
        projectName: 'other-project',
        kind: 'restore',
        severity: 'critical',
        error: 'target missing',
        read: true,
      }),
    ]);
    renderScreen('/health?tab=alerts');
    const first = await screen.findByTestId('health-alert-a1');
    expect(first).toHaveClass('font-medium');
    expect(first).toHaveTextContent('my-project');
    expect(first).toHaveTextContent('Backup');
    expect(first).toHaveTextContent('Warning');
    expect(first).toHaveTextContent('restic exited 1');
    expect(first).toHaveTextContent(new Date('2024-01-01T00:00:00Z').toLocaleString('en'));
    expect(first).toHaveTextContent('Unread');
    const second = screen.getByTestId('health-alert-a2');
    expect(second).not.toHaveClass('font-medium');
    expect(second).toHaveTextContent('other-project');
    expect(second).toHaveTextContent('Restore');
    expect(second).toHaveTextContent('Critical');
    expect(second).not.toHaveTextContent('Unread');
    // Unread counter chip on the tab trigger.
    expect(screen.getByRole('tab', { name: /Alerts/ })).toHaveTextContent('1');
  });

  it('shows the empty state when there are no alerts', async () => {
    renderScreen('/health?tab=alerts');
    expect(await screen.findByTestId('alerts-empty')).toBeInTheDocument();
  });

  it('shows a loading indicator while alerts are pending', async () => {
    mocked.fetchAlertsRequest.mockReturnValue(new Promise(() => {}));
    renderScreen('/health?tab=alerts');
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows an error alert (and the fallback message once error is cleared)', async () => {
    mocked.fetchAlertsRequest.mockRejectedValue(new Error('alerts down'));
    const { store } = renderScreen('/health?tab=alerts');
    expect(await screen.findByRole('alert')).toHaveTextContent('alerts down');
    act(() => {
      store.dispatch({ type: fetchHealthOverview.pending.type });
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load health data.');
  });

  it('mark all read: disables the button, shows the spinner, then marks alerts locally', async () => {
    mocked.fetchOverviewRequest.mockResolvedValue(makeOverview({ unreadAlerts: 1 }));
    mocked.fetchAlertsRequest.mockResolvedValue([makeAlert({ id: 'a1', read: false })]);
    let resolveMark!: (n: number) => void;
    mocked.markAlertsReadRequest.mockReturnValue(
      new Promise<number>((resolve) => {
        resolveMark = resolve;
      }),
    );
    const { store } = renderScreen('/health?tab=alerts');
    const button = await screen.findByRole('button', { name: 'Mark all read' });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Marking…');
    expect(mocked.markAlertsReadRequest).toHaveBeenCalledWith(undefined);
    act(() => {
      resolveMark(1);
    });
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.getByText('Alerts marked as read.')).toBeInTheDocument();
    expect(store.getState().health.alerts.every((a) => a.read)).toBe(true);
    expect(store.getState().health.overview?.unreadAlerts).toBe(0);
    expect(screen.queryByText('Unread')).toBeNull();
  });

  it('switching tabs via the trigger updates the URL-backed tab state', async () => {
    const user = userEvent.setup();
    mocked.fetchAlertsRequest.mockResolvedValue([]);
    renderScreen();
    await screen.findByTestId('health-banner');
    await user.click(screen.getByRole('tab', { name: /Alerts/ }));
    expect(await screen.findByTestId('alerts-empty')).toBeInTheDocument();
  });
});
