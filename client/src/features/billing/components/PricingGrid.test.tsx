import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { configureStore } from '@reduxjs/toolkit';
import { PricingGrid } from './PricingGrid';
import { billingReducer } from '../store/slice';
import { i18n, initI18n } from '@shared/i18n';
import type { BillingOverview, PricingTier } from '../types';
import * as api from '../api';

vi.mock('../api', () => ({
  fetchPricingTiers: vi.fn(),
  fetchBillingOverview: vi.fn(),
  createCheckout: vi.fn(),
  changePlan: vi.fn(),
}));

const mockedApi = vi.mocked(api);

const TIERS: PricingTier[] = [
  {
    slug: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    productIdMonthly: null,
    productIdYearly: null,
    caps: { projects: 1, retentionDays: 7, frequency: 'daily' },
    flags: { schedules: false, emailAlerts: false, multiVps: false },
  },
  {
    slug: 'pro',
    name: 'Pro',
    priceMonthly: 1000,
    priceYearly: 10000,
    productIdMonthly: 'pm',
    productIdYearly: 'py',
    caps: { projects: 10, retentionDays: 30, frequency: 'hourly' },
    flags: { schedules: true, emailAlerts: true, multiVps: false },
  },
  {
    slug: 'business',
    name: 'Business',
    priceMonthly: 3000,
    priceYearly: 30000,
    productIdMonthly: 'bm',
    productIdYearly: 'by',
    caps: { projects: null, retentionDays: 90, frequency: 'any-cron' },
    flags: { schedules: true, emailAlerts: true, multiVps: true },
  },
];

const overview = (slug: BillingOverview['slug'], status: BillingOverview['status']): BillingOverview => ({
  slug,
  status,
  currentPeriodEnd: null,
  graceEndsAt: null,
  cancelAtPeriodEnd: false,
  selectionRequired: false,
});

const renderGrid = () =>
  render(
    <Provider store={configureStore({ reducer: { billing: billingReducer } })}>
      <I18nextProvider i18n={i18n}>
        <PricingGrid />
      </I18nextProvider>
    </Provider>,
  );

const originalLocation = window.location;

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
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

describe('PricingGrid', () => {
  it('shows the loading state while tiers load', () => {
    mockedApi.fetchPricingTiers.mockReturnValue(new Promise(() => {}));
    mockedApi.fetchBillingOverview.mockReturnValue(new Promise(() => {}));
    renderGrid();
    expect(screen.getByRole('status')).toHaveTextContent(/loading pricing/i);
  });

  it('shows the empty state when there are no tiers', async () => {
    mockedApi.fetchPricingTiers.mockResolvedValue({ tiers: [] });
    mockedApi.fetchBillingOverview.mockResolvedValue(overview('free', 'none'));
    renderGrid();
    expect(await screen.findByText(/no plans available/i)).toBeInTheDocument();
  });

  it('renders all tiers with caps, flags, and free/paid pricing', async () => {
    mockedApi.fetchPricingTiers.mockResolvedValue({ tiers: TIERS });
    mockedApi.fetchBillingOverview.mockResolvedValue(overview('free', 'none'));
    renderGrid();
    expect(await screen.findByRole('heading', { name: 'Pro' })).toBeInTheDocument();
    // Free tier price label + unlimited on business.
    expect(screen.getAllByText(/^Free$/).length).toBeGreaterThan(0);
    expect(screen.getByText(/\$10/)).toBeInTheDocument(); // pro monthly $10
    expect(screen.getByText(/unlimited/i)).toBeInTheDocument();
    expect(screen.getByText(/hourly backups/i)).toBeInTheDocument();
    expect(screen.getByText(/any cron/i)).toBeInTheDocument();
    expect(screen.getByText(/multi-vps/i)).toBeInTheDocument();
    // Free is the current plan.
    expect(screen.getByRole('button', { name: /current plan/i })).toBeInTheDocument();
    // Paid non-current tiers use "Get started".
    expect(screen.getAllByRole('button', { name: /get started/i }).length).toBe(2);
  });

  it('toggles between yearly and monthly pricing', async () => {
    mockedApi.fetchPricingTiers.mockResolvedValue({ tiers: TIERS });
    mockedApi.fetchBillingOverview.mockResolvedValue(overview('free', 'none'));
    renderGrid();
    await screen.findByRole('heading', { name: 'Pro' });
    fireEvent.click(screen.getByRole('tab', { name: /yearly/i }));
    expect(screen.getByText(/\$100/)).toBeInTheDocument(); // pro yearly $100
    fireEvent.click(screen.getByRole('tab', { name: /monthly/i }));
    expect(screen.getByText(/\$10$/)).toBeInTheDocument(); // pro monthly $10
  });

  it('no-ops when the selected tier has a falsy product id', async () => {
    const tiersWithBlankId: PricingTier[] = [
      TIERS[0]!,
      { ...TIERS[1]!, productIdMonthly: '' },
    ];
    mockedApi.fetchPricingTiers.mockResolvedValue({ tiers: tiersWithBlankId });
    mockedApi.fetchBillingOverview.mockResolvedValue(overview('free', 'none'));
    renderGrid();
    // Pro is enabled (productId '' is !== null so canSelect is true) but the
    // onSelect guard returns because '' is falsy — no checkout is started.
    const cta = await screen.findByRole('button', { name: /get started/i });
    fireEvent.click(cta);
    await Promise.resolve();
    expect(mockedApi.createCheckout).not.toHaveBeenCalled();
    expect(mockedApi.changePlan).not.toHaveBeenCalled();
  });

  it('shows an error banner and starts checkout for a new subscriber', async () => {
    mockedApi.fetchPricingTiers.mockResolvedValue({ tiers: TIERS });
    mockedApi.fetchBillingOverview.mockRejectedValue(new Error('overview down'));
    mockedApi.createCheckout.mockResolvedValue({
      url: 'https://redirect.example/checkout',
      providerCheckoutId: 'pc_1',
    });
    renderGrid();
    await screen.findByRole('heading', { name: 'Pro' });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    // Pro is selectable (Get started); clicking starts checkout and redirects.
    const proCta = screen.getAllByRole('button', { name: /get started/i })[0]!;
    fireEvent.click(proCta);
    await waitFor(() =>
      expect(window.location.href).toBe('https://redirect.example/checkout'),
    );
    expect(mockedApi.createCheckout).toHaveBeenCalledWith(
      'pm',
      'http://localhost/billing?tab=overview',
      'http://localhost/billing?tab=overview',
    );
  });

  it('starts checkout with the yearly product id when yearly is selected', async () => {
    mockedApi.fetchPricingTiers.mockResolvedValue({ tiers: TIERS });
    mockedApi.fetchBillingOverview.mockResolvedValue(overview('free', 'none'));
    mockedApi.createCheckout.mockResolvedValue({
      url: 'https://redirect.example/yearly',
      providerCheckoutId: 'pc_2',
    });
    renderGrid();
    await screen.findByRole('heading', { name: 'Pro' });
    fireEvent.click(screen.getByRole('tab', { name: /yearly/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /get started/i })[0]!);
    await waitFor(() =>
      expect(mockedApi.createCheckout).toHaveBeenCalledWith(
        'py',
        'http://localhost/billing?tab=overview',
        'http://localhost/billing?tab=overview',
      ),
    );
  });

  it('does not redirect when checkout is rejected', async () => {
    mockedApi.fetchPricingTiers.mockResolvedValue({ tiers: TIERS });
    mockedApi.fetchBillingOverview.mockResolvedValue(overview('free', 'none'));
    mockedApi.createCheckout.mockRejectedValue(new Error('nope'));
    renderGrid();
    await screen.findByRole('heading', { name: 'Pro' });
    fireEvent.click(screen.getAllByRole('button', { name: /get started/i })[0]!);
    await waitFor(() => expect(mockedApi.createCheckout).toHaveBeenCalled());
    expect(window.location.href).toBe('');
  });

  it('changes plan directly for an existing paid subscriber', async () => {
    mockedApi.fetchPricingTiers.mockResolvedValue({ tiers: TIERS });
    mockedApi.fetchBillingOverview.mockResolvedValue(overview('pro', 'active'));
    mockedApi.changePlan.mockResolvedValue({ status: 'active' });
    renderGrid();
    // Pro is current; free + business both show "Switch" but only business is enabled.
    const switchBtns = await screen.findAllByRole('button', { name: /switch to this plan/i });
    const enabled = switchBtns.find((b) => !(b as HTMLButtonElement).disabled);
    fireEvent.click(enabled as HTMLButtonElement);
    await waitFor(() => expect(mockedApi.changePlan).toHaveBeenCalledWith('bm'));
    expect(mockedApi.createCheckout).not.toHaveBeenCalled();
  });
});
