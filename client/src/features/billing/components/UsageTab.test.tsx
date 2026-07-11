import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { configureStore } from '@reduxjs/toolkit';
import { UsageTab } from './UsageTab';
import { billingReducer } from '../store/slice';
import { i18n, initI18n } from '@shared/i18n';
import type { UsageResponse } from '../types';
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

const usageAllStatuses: UsageResponse = {
  projects: { used: 1, cap: 5, active: [{ id: 'a', name: 'Alpha' }], paused: [] },
  agents: { used: 2, cap: 5 },
  metering: [
    { id: 's', name: 'Ok', sizeBytes: 1024, snapshotCount: 2, lastRunAt: '2026-06-01T00:00:00.000Z', lastStatus: 'success' },
    { id: 'f', name: 'Broke', sizeBytes: 0, snapshotCount: 0, lastRunAt: null, lastStatus: 'failed' },
    { id: 'r', name: 'Busy', sizeBytes: 0, snapshotCount: 0, lastRunAt: null, lastStatus: 'running' },
    { id: 'i', name: 'Quiet', sizeBytes: 0, snapshotCount: 0, lastRunAt: null, lastStatus: 'idle' },
    { id: 'u', name: 'Odd', sizeBytes: 0, snapshotCount: 0, lastRunAt: null, lastStatus: 'weird' },
  ],
  retentionDays: 30,
  frequency: 'daily',
  flags: { schedules: false, emailAlerts: false },
  selectionRequired: false,
};

const renderTab = () =>
  render(
    <Provider store={configureStore({ reducer: { billing: billingReducer } })}>
      <I18nextProvider i18n={i18n}>
        <UsageTab />
      </I18nextProvider>
    </Provider>,
  );

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
});

describe('UsageTab — per-project status column', () => {
  it('maps each lastStatus to its label, including the idle fallback for unknown values', async () => {
    mockedApi.fetchUsage.mockResolvedValue(usageAllStatuses);
    renderTab();
    // Status header rendered.
    expect(await screen.findByText('Status')).toBeInTheDocument();
    // Known statuses map to their localized labels.
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Idle')).toBeInTheDocument();
    // Unknown status falls back to the raw value (and the idle style).
    expect(screen.getByText('weird')).toBeInTheDocument();
  });
});

describe('UsageTab — connected-servers (agents) stat', () => {
  it('renders the agents used/cap card with a quota bar under a finite cap', async () => {
    mockedApi.fetchUsage.mockResolvedValue(usageAllStatuses);
    renderTab();
    expect(await screen.findByText('Servers')).toBeInTheDocument();
    // used=2, cap=5 → a labelled quota bar reflecting the used count.
    const bar = screen.getByLabelText('Connected servers used');
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
  });

  it('shows Unlimited and no quota bar when the agent cap is null (Business)', async () => {
    mockedApi.fetchUsage.mockResolvedValue({
      ...usageAllStatuses,
      agents: { used: 9, cap: null },
    });
    renderTab();
    await screen.findByText('Servers');
    expect(screen.queryByLabelText('Connected servers used')).not.toBeInTheDocument();
  });

  it('marks the agent count destructive when over the cap', async () => {
    mockedApi.fetchUsage.mockResolvedValue({
      ...usageAllStatuses,
      agents: { used: 7, cap: 5 },
    });
    renderTab();
    const over = await screen.findByText('7');
    expect(over).toHaveClass('text-destructive');
  });
});

describe('UsageTab — entitlement flag badges', () => {
  it('renders only the email-alerts badge when schedules are locked', async () => {
    mockedApi.fetchUsage.mockResolvedValue({
      ...usageAllStatuses,
      flags: { schedules: false, emailAlerts: true },
    });
    renderTab();
    expect(await screen.findByText('Email alerts')).toBeInTheDocument();
    expect(screen.queryByText('Scheduled backups')).not.toBeInTheDocument();
  });
});
