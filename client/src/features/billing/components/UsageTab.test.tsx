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
  metering: [
    { id: 's', name: 'Ok', sizeBytes: 1024, snapshotCount: 2, lastRunAt: '2026-06-01T00:00:00.000Z', lastStatus: 'success' },
    { id: 'f', name: 'Broke', sizeBytes: 0, snapshotCount: 0, lastRunAt: null, lastStatus: 'failed' },
    { id: 'r', name: 'Busy', sizeBytes: 0, snapshotCount: 0, lastRunAt: null, lastStatus: 'running' },
    { id: 'i', name: 'Quiet', sizeBytes: 0, snapshotCount: 0, lastRunAt: null, lastStatus: 'idle' },
    { id: 'u', name: 'Odd', sizeBytes: 0, snapshotCount: 0, lastRunAt: null, lastStatus: 'weird' },
  ],
  retentionDays: 30,
  frequency: 'daily',
  flags: { schedules: false, emailAlerts: false, multiVps: false },
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
