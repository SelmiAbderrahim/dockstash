import { describe, expect, it, vi, beforeEach } from 'vitest';
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
  flags: { schedules: true, emailAlerts: true, multiVps: false },
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
  flags: { schedules: true, emailAlerts: false, multiVps: false },
  selectionRequired: true,
};

const usageEmpty: UsageResponse = {
  projects: { used: 0, cap: null, active: [], paused: [] },
  metering: [],
  retentionDays: 7,
  frequency: 'daily',
  flags: { schedules: false, emailAlerts: false, multiVps: false },
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

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
  mockedApi.fetchUsage.mockResolvedValue(usageEmpty);
  mockedApi.fetchBillingOverview.mockResolvedValue(bareOverview);
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

  it('shows the usage empty state when usage fails to load', async () => {
    mockedApi.fetchUsage.mockRejectedValue(new Error('usage boom'));
    renderPage('/billing?tab=usage');
    expect(await screen.findByText(/nothing to show/i)).toBeInTheDocument();
  });

  it('toggles project selection and submits the kept projects', async () => {
    mockedApi.fetchUsage.mockResolvedValue(usageOverCap);
    mockedApi.selectProjectsToKeep.mockResolvedValue({ active: 1, paused: 1 });
    renderPage('/billing?tab=usage');
    const alphaCheckbox = (await screen.findByLabelText(/alpha/i)) as HTMLInputElement;
    const submit = screen.getByRole('button', { name: /save selection/i });

    expect(submit).toBeDisabled();
    // toggle on
    fireEvent.click(alphaCheckbox);
    expect(alphaCheckbox.checked).toBe(true);
    expect(submit).toBeEnabled();
    // toggle off (covers the remove branch)
    fireEvent.click(alphaCheckbox);
    expect(alphaCheckbox.checked).toBe(false);
    // toggle back on and submit
    fireEvent.click(alphaCheckbox);
    fireEvent.click(submit);
    await waitFor(() =>
      expect(mockedApi.selectProjectsToKeep).toHaveBeenCalledWith(['a']),
    );
    // usage reloaded after submit
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
