import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { BillingPage } from './BillingPage';
import { billingReducer } from '../store/slice';
import { i18n, initI18n } from '@shared/i18n';
import type { BillingOverview, UsageResponse } from '../types';
import * as api from '../api';

vi.mock('../api', () => ({
  fetchBillingOverview: vi.fn(),
  fetchUsage: vi.fn(),
  selectProjectsToKeep: vi.fn(),
  fetchPricingTiers: vi.fn(),
  createCheckout: vi.fn(),
  changePlan: vi.fn(),
  openPortalRequest: vi.fn(),
}));

const mockedApi = vi.mocked(api);

const fullOverview: BillingOverview = {
  slug: 'pro',
  status: 'active',
  currentPeriodEnd: '2026-01-01T00:00:00.000Z',
  graceEndsAt: '2026-02-01T00:00:00.000Z',
  cancelAtPeriodEnd: true,
  selectionRequired: false,
};

const bareOverview: BillingOverview = {
  slug: 'free',
  status: 'none',
  currentPeriodEnd: null,
  graceEndsAt: null,
  cancelAtPeriodEnd: false,
  selectionRequired: false,
};

const usageOverCap: UsageResponse = {
  projects: {
    used: 3,
    cap: 1,
    active: [{ id: 'a', name: 'Alpha' }],
    paused: [{ id: 'b', name: 'Beta' }],
  },
  metering: [
    {
      id: 'a',
      name: 'Alpha',
      sizeBytes: 2048,
      snapshotCount: 4,
      lastRunAt: '2026-06-01T00:00:00.000Z',
      lastStatus: 'success',
    },
    {
      id: 'b',
      name: 'Beta',
      sizeBytes: 0,
      snapshotCount: 0,
      lastRunAt: null,
      lastStatus: 'never',
    },
  ],
  retentionDays: 30,
  frequency: 'hourly',
  agents: { used: 1, cap: null },
  flags: { schedules: true, emailAlerts: true },
  selectionRequired: true,
};

const usageSelectionNoCap: UsageResponse = {
  projects: {
    used: 2,
    cap: null,
    active: [{ id: 'a', name: 'Alpha' }],
    paused: [],
  },
  metering: [],
  retentionDays: 30,
  frequency: 'daily',
  agents: { used: 1, cap: null },
  flags: { schedules: true, emailAlerts: false },
  selectionRequired: true,
};

const usageEmpty: UsageResponse = {
  projects: { used: 0, cap: null, active: [], paused: [] },
  metering: [],
  retentionDays: 7,
  frequency: 'daily',
  agents: { used: 0, cap: null },
  flags: { schedules: false, emailAlerts: false },
  selectionRequired: false,
};

const renderPage = (entry = '/billing') =>
  render(
    <Provider store={configureStore({ reducer: { billing: billingReducer } })}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[entry]}>
          <BillingPage />
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );

const originalLocation = window.location;

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
  mockedApi.fetchUsage.mockResolvedValue(usageEmpty);
  mockedApi.fetchBillingOverview.mockResolvedValue(bareOverview);
  mockedApi.fetchPricingTiers.mockResolvedValue({ tiers: [] });
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { origin: 'http://localhost', href: '' },
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
});

describe('BillingPage — overview tab', () => {
  it('shows the loading state while the overview loads', () => {
    mockedApi.fetchBillingOverview.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });

  it('renders full overview details (renews, grace, cancel notice)', async () => {
    mockedApi.fetchBillingOverview.mockResolvedValue(fullOverview);
    renderPage();
    expect(await screen.findByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText(/renews on/i)).toBeInTheDocument();
    expect(screen.getByText(/grace period ends/i)).toBeInTheDocument();
    expect(screen.getByText(/your plan will end at the current period/i)).toBeInTheDocument();
  });

  it('omits optional overview rows when absent', async () => {
    mockedApi.fetchBillingOverview.mockResolvedValue(bareOverview);
    renderPage();
    expect(await screen.findByText('Free')).toBeInTheDocument();
    expect(screen.queryByText(/renews on/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/grace period ends/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/your plan will end/i)).not.toBeInTheDocument();
  });

  it('shows the empty state and error alert when the overview fails', async () => {
    mockedApi.fetchBillingOverview.mockRejectedValue(new Error('overview boom'));
    renderPage();
    expect(await screen.findByText(/nothing to show/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('BillingPage — usage tab', () => {
  it('renders metering rows, over-cap alert, and selection UI', async () => {
    mockedApi.fetchUsage.mockResolvedValue(usageOverCap);
    renderPage('/billing?tab=usage');
    // metering row for Alpha with formatted size.
    expect(await screen.findByText('2.0 KB')).toBeInTheDocument();
    // Alpha appears in both the metering table and the selection list.
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0);
    expect(screen.getByText('Never')).toBeInTheDocument();
    expect(screen.getByText(/over your project cap/i)).toBeInTheDocument();
    // selection UI present.
    expect(screen.getByRole('heading', { name: /pick which projects/i })).toBeInTheDocument();
  });

  it('renders the empty metering state and no over-cap alert for unlimited cap', async () => {
    mockedApi.fetchUsage.mockResolvedValue(usageEmpty);
    renderPage('/billing?tab=usage');
    expect(await screen.findByText(/no active projects yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/over your project cap/i)).not.toBeInTheDocument();
    // Unlimited cap → no quota progress bar.
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('renders stat tiles, a quota bar, and feature badges for a capped plan', async () => {
    mockedApi.fetchUsage.mockResolvedValue(usageOverCap);
    renderPage('/billing?tab=usage');
    // Stat tile labels.
    expect(await screen.findByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Retention')).toBeInTheDocument();
    expect(screen.getByText(/backup frequency/i)).toBeInTheDocument();
    // Capped plan → quota progress bar reflecting used/cap.
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '1');
    // Entitlement flags surface as badges (schedules + emailAlerts on).
    expect(screen.getByText(/scheduled backups/i)).toBeInTheDocument();
    expect(screen.getByText(/email alerts/i)).toBeInTheDocument();
    // The connected-servers stat card is always present.
    expect(screen.getByText('Servers')).toBeInTheDocument();
  });

  it('renders the selection UI with an unlimited (null) cap', async () => {
    mockedApi.fetchUsage.mockResolvedValue(usageSelectionNoCap);
    renderPage('/billing?tab=usage');
    expect(
      await screen.findByRole('heading', { name: /pick which projects/i }),
    ).toBeInTheDocument();
    // No over-cap alert because cap is null.
    expect(screen.queryByText(/over your project cap/i)).not.toBeInTheDocument();
  });

  it('shows the usage loading state', () => {
    mockedApi.fetchUsage.mockReturnValue(new Promise(() => {}));
    renderPage('/billing?tab=usage');
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });

  it('shows an inline error with a retry action when usage fails to load', async () => {
    mockedApi.fetchUsage.mockRejectedValueOnce(new Error('usage boom'));
    mockedApi.fetchUsage.mockResolvedValueOnce(usageEmpty);
    renderPage('/billing?tab=usage');
    expect(await screen.findByText('usage boom')).toBeInTheDocument();
    // Retry re-dispatches loadUsage and recovers.
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText(/no active projects yet/i)).toBeInTheDocument();
    expect(mockedApi.fetchUsage).toHaveBeenCalledTimes(2);
  });

  it('toggles project selection and submits the kept projects', async () => {
    mockedApi.fetchUsage.mockResolvedValue(usageOverCap);
    mockedApi.selectProjectsToKeep.mockResolvedValue({ active: 1, paused: 1 });
    renderPage('/billing?tab=usage');
    // shadcn/Radix Checkbox renders a <button role="checkbox"> tracked via aria-checked.
    const alphaCheckbox = await screen.findByRole('checkbox', { name: /alpha/i });
    const submit = screen.getByRole('button', { name: /save selection/i });

    expect(submit).toBeDisabled();
    // toggle on
    fireEvent.click(alphaCheckbox);
    expect(alphaCheckbox).toBeChecked();
    expect(submit).toBeEnabled();
    // toggle off (covers the remove branch)
    fireEvent.click(alphaCheckbox);
    expect(alphaCheckbox).not.toBeChecked();
    // toggle back on and submit
    fireEvent.click(alphaCheckbox);
    fireEvent.click(submit);
    await waitFor(() =>
      expect(mockedApi.selectProjectsToKeep).toHaveBeenCalledWith(['a']),
    );
    // usage reloaded after submit
    await waitFor(() => expect(mockedApi.fetchUsage).toHaveBeenCalledTimes(2));
  });

  it('locks the selection form with a spinner while the downgrade is in flight', async () => {
    mockedApi.fetchUsage.mockResolvedValue(usageOverCap);
    let resolveSelect: (v: { active: number; paused: number }) => void = () => {};
    mockedApi.selectProjectsToKeep.mockReturnValue(
      new Promise<{ active: number; paused: number }>((resolve) => {
        resolveSelect = resolve;
      }),
    );
    renderPage('/billing?tab=usage');
    const alphaCheckbox = await screen.findByRole('checkbox', { name: /alpha/i });
    const submit = screen.getByRole('button', { name: /save selection/i });
    fireEvent.click(alphaCheckbox);
    fireEvent.click(submit);
    // While the request is unresolved the whole form is locked.
    await waitFor(() => expect(submit).toBeDisabled());
    expect(submit).toHaveAttribute('aria-busy', 'true');
    expect(alphaCheckbox).toBeDisabled();
    // Resolving unlocks the form and reloads usage.
    resolveSelect({ active: 1, paused: 1 });
    await waitFor(() => expect(mockedApi.fetchUsage).toHaveBeenCalledTimes(2));
  });

  it('switches tabs via the tab buttons', async () => {
    mockedApi.fetchUsage.mockResolvedValue(usageEmpty);
    renderPage();
    await screen.findByText('Free');
    // The tab bar is a Radix Tabs control; user-event drives the pointer
    // interaction it expects (fireEvent.click does not activate it).
    await userEvent.click(screen.getByRole('tab', { name: /usage/i }));
    expect(await screen.findByText(/no active projects yet/i)).toBeInTheDocument();
  });
});

describe('BillingPage — plans tab', () => {
  it('renders the pricing grid and hides the portal button with no subscription', async () => {
    renderPage('/billing?tab=plans');
    // Empty tiers → grid empty state; overview status "none" → no portal button.
    expect(await screen.findByText(/no plans available/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /manage billing/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the portal button for subscribers and redirects on click', async () => {
    mockedApi.fetchBillingOverview.mockResolvedValue(fullOverview);
    mockedApi.openPortalRequest.mockResolvedValue({ url: 'https://portal.example' });
    renderPage('/billing?tab=plans');
    const portal = await screen.findByRole('button', { name: /manage billing/i });
    fireEvent.click(portal);
    await waitFor(() => expect(window.location.href).toBe('https://portal.example'));
    expect(mockedApi.openPortalRequest).toHaveBeenCalledOnce();
  });

  it('surfaces a page-level error when the portal call fails', async () => {
    mockedApi.fetchBillingOverview.mockResolvedValue(fullOverview);
    mockedApi.openPortalRequest.mockRejectedValue(new Error('portal down'));
    renderPage('/billing?tab=plans');
    fireEvent.click(await screen.findByRole('button', { name: /manage billing/i }));
    expect(await screen.findByText('portal down')).toBeInTheDocument();
    expect(window.location.href).toBe('');
  });
});
