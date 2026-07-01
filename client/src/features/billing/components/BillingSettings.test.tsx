import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { BillingSettings } from './BillingSettings';
import { billingReducer } from '../store/slice';
import type { BillingState, Customer } from '../types';
import * as api from '../api';

vi.mock('../stripeGlobal', () => ({
  loadStripeScript: vi.fn(),
  getStripe: vi.fn(() => undefined),
}));

vi.mock('../api', () => ({
  fetchCustomerRequest: vi.fn(),
  cancelSubscriptionRequest: vi.fn(),
  updateSubscriptionRequest: vi.fn(),
  createCustomerRequest: vi.fn(),
  updateBillingRequest: vi.fn(),
}));

const mockedApi = vi.mocked(api);

const activeCustomer: Customer = {
  subscriptions: {
    total_count: 1,
    data: [{ plan: { id: 'gold', amount: 1500 }, current_period_end: 1735689600, cancel_at_period_end: false }],
  },
  sources: { total_count: 1, data: [{ last4: '4242' }] },
};

const cancelingCustomer: Customer = {
  subscriptions: {
    total_count: 1,
    data: [{ plan: { id: 'silver', amount: 999 }, current_period_end: 1735689600, cancel_at_period_end: true }],
  },
  sources: { total_count: 1, data: [{ last4: '1111' }] },
};

const renderSettings = (preloaded?: Partial<BillingState>) =>
  render(
    <Provider
      store={configureStore({
        reducer: { billing: billingReducer },
        preloadedState: preloaded ? { billing: { ...baseState, ...preloaded } } : undefined,
      })}
    >
      <BillingSettings />
    </Provider>,
  );

const baseState: BillingState = {
  customer: {},
  message: '',
  error: '',
  tiers: [],
  overview: null,
  usage: null,
  loadingTiers: false,
  loadingOverview: false,
  loadingUsage: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.fetchCustomerRequest.mockResolvedValue({ customer: activeCustomer });
  mockedApi.cancelSubscriptionRequest.mockResolvedValue({ message: 'canceled' });
  mockedApi.updateSubscriptionRequest.mockResolvedValue({ message: 'changed' });
});

describe('BillingSettings — plan rendering', () => {
  it('shows Loading while the customer has no subscriptions/sources', () => {
    mockedApi.fetchCustomerRequest.mockReturnValue(new Promise(() => {}));
    renderSettings();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows Loading when the subscription/source records are missing', async () => {
    mockedApi.fetchCustomerRequest.mockResolvedValue({
      customer: { subscriptions: { total_count: 1, data: [] }, sources: { total_count: 1, data: [] } },
    });
    renderSettings();
    await waitFor(() => expect(mockedApi.fetchCustomerRequest).toHaveBeenCalled());
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders the cancel-at-period-end notice', async () => {
    mockedApi.fetchCustomerRequest.mockResolvedValue({ customer: cancelingCustomer });
    renderSettings();
    expect(await screen.findByText(/will expire on/i)).toHaveTextContent(/silver/i);
  });

  it('renders the active subscription with amount and last four', async () => {
    renderSettings();
    const active = await screen.findByText(/subscribed to the gold plan/i);
    expect(active).toHaveTextContent(/4242/);
    expect(active).toHaveTextContent(/15\.00/);
  });

  it('renders error and success banners', async () => {
    renderSettings({ error: 'boom', message: 'saved' });
    expect(await screen.findByText(/boom/i)).toBeInTheDocument();
    expect(screen.getByText(/saved/i)).toBeInTheDocument();
  });
});

describe('BillingSettings — account actions', () => {
  it('opens the change-subscription controls, changes the plan, and cancels', async () => {
    renderSettings();
    fireEvent.click(await screen.findByRole('button', { name: /change subscription/i }));

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'silver' } });
    fireEvent.click(screen.getByRole('button', { name: /^change$/i }));
    await waitFor(() =>
      expect(mockedApi.updateSubscriptionRequest).toHaveBeenCalledWith('silver'),
    );

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.getByRole('button', { name: /change subscription/i })).toBeInTheDocument();
  });

  it('opens the update-billing form and closes it', async () => {
    renderSettings();
    fireEvent.click(await screen.findByRole('button', { name: /update billing information/i }));
    expect(screen.getByLabelText(/card number/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(
      screen.getByRole('button', { name: /update billing information/i }),
    ).toBeInTheDocument();
  });

  it('confirms cancellation with Yes', async () => {
    renderSettings();
    fireEvent.click(await screen.findByRole('button', { name: /cancel subscription/i }));
    expect(screen.getByText(/do you really want to cancel/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^yes$/i }));
    await waitFor(() => expect(mockedApi.cancelSubscriptionRequest).toHaveBeenCalled());
  });

  it('dismisses the cancellation confirmation with No', async () => {
    renderSettings();
    fireEvent.click(await screen.findByRole('button', { name: /cancel subscription/i }));
    fireEvent.click(screen.getByRole('button', { name: /^no$/i }));
    expect(
      screen.getByRole('button', { name: /cancel subscription/i }),
    ).toBeInTheDocument();
  });
});
