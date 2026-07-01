import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { configureStore } from '@reduxjs/toolkit';
import { PricingPage } from './PricingPage';
import { billingReducer } from '../store/slice';
import { i18n, initI18n } from '@shared/i18n';

vi.mock('../api', () => ({
  fetchPricingTiers: vi.fn(() => new Promise(() => {})),
  fetchBillingOverview: vi.fn(() => new Promise(() => {})),
  createCheckout: vi.fn(),
  changePlan: vi.fn(),
}));

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
});

describe('PricingPage', () => {
  it('renders the pricing heading, subtitle, and the grid', () => {
    render(
      <Provider store={configureStore({ reducer: { billing: billingReducer } })}>
        <I18nextProvider i18n={i18n}>
          <PricingPage />
        </I18nextProvider>
      </Provider>,
    );
    expect(screen.getByRole('heading', { name: /pricing/i })).toBeInTheDocument();
    expect(screen.getByText(/pick a plan\. cancel anytime\./i)).toBeInTheDocument();
    // Grid is present (loading state because api never resolves).
    expect(screen.getByRole('status')).toHaveTextContent(/loading pricing/i);
  });
});
