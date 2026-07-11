import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { i18n, initI18n } from '@shared/i18n';
import { authReducer } from '@features/auth';
import { InvitationClaimPage } from './InvitationClaimPage';
import { billingReducer } from '../store/slice';
import type { BillingState, PublicInvitation } from '../types';
import * as api from '../api';

vi.mock('../api', () => ({
  fetchBillingOverview: vi.fn(),
  fetchUsage: vi.fn(),
  selectProjectsToKeep: vi.fn(),
  fetchPricingTiers: vi.fn(),
  createCheckout: vi.fn(),
  changePlan: vi.fn(),
  openPortalRequest: vi.fn(),
  fetchInvitation: vi.fn(),
  claimInvitationRequest: vi.fn(),
}));

const mocked = vi.mocked(api);

const offer: PublicInvitation = {
  plan: 'business',
  grantDuration: 'one_year',
  expiresAt: '2030-01-01T00:00:00.000Z',
  status: 'pending',
};

const LocationProbe = () => <span data-testid="loc">{useLocation().pathname}</span>;

const makeStore = (
  billing: Partial<BillingState> = {},
  auth: { authenticated?: boolean; emailVerified?: boolean } = {},
) => {
  const store = configureStore({
    reducer: { billing: billingReducer, auth: authReducer },
  });
  const base = store.getState();
  return configureStore({
    reducer: { billing: billingReducer, auth: authReducer },
    preloadedState: {
      billing: { ...base.billing, ...billing },
      auth: {
        ...base.auth,
        authenticated: auth.authenticated ?? true,
        emailVerified: auth.emailVerified ?? true,
      },
    },
  });
};

const renderPage = (
  billing: Partial<BillingState> = {},
  auth: { authenticated?: boolean; emailVerified?: boolean } = {},
) =>
  render(
    <Provider store={makeStore(billing, auth)}>
      <I18nextProvider i18n={i18n}>
        <HelmetProvider>
          <MemoryRouter initialEntries={['/invite/tok-1']}>
            <Routes>
              <Route path="/invite/:token" element={<InvitationClaimPage />} />
              <Route path="*" element={<LocationProbe />} />
            </Routes>
          </MemoryRouter>
        </HelmetProvider>
      </I18nextProvider>
    </Provider>,
  );

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
  mocked.fetchInvitation.mockReturnValue(new Promise(() => {}) as never);
});

describe('InvitationClaimPage', () => {
  it('bounces an anonymous visitor to /login carrying the token', async () => {
    renderPage({}, { authenticated: false });
    expect(await screen.findByTestId('loc')).toHaveTextContent('/login');
  });

  it('shows the loading state until the offer resolves', () => {
    renderPage();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the offer and activates it', async () => {
    const user = userEvent.setup();
    mocked.fetchInvitation.mockResolvedValue(offer);
    mocked.claimInvitationRequest.mockResolvedValue({
      plan: 'business',
      grantDuration: 'one_year',
      currentPeriodEnd: '2031-01-01T00:00:00.000Z',
    });
    renderPage();

    expect(await screen.findByText('Business')).toBeInTheDocument();
    expect(screen.getByText('1 year')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /activate/i }));
    await waitFor(() => expect(mocked.claimInvitationRequest).toHaveBeenCalledWith('tok-1'));
    expect(await screen.findByText(/you are all set/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to the dashboard/i })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  it('surfaces a claim error with a plans CTA', async () => {
    const user = userEvent.setup();
    mocked.fetchInvitation.mockResolvedValue(offer);
    mocked.claimInvitationRequest.mockRejectedValue(new Error('You already have a paid plan.'));
    renderPage();

    await user.click(await screen.findByRole('button', { name: /activate/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You already have a paid plan.');
    expect(screen.getByRole('link', { name: /see plans/i })).toHaveAttribute(
      'href',
      '/billing?tab=plans',
    );
  });

  it('asks an unverified user to verify their email first', async () => {
    renderPage({}, { emailVerified: false });
    expect(await screen.findByText(/verify your email first/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /verify email/i })).toHaveAttribute(
      'href',
      '/verify-email',
    );
  });

  it('renders a dead-link state for an unknown token', async () => {
    mocked.fetchInvitation.mockRejectedValue(new Error('That invitation link is not valid.'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('not valid');
    expect(screen.getByRole('link', { name: /go to the dashboard/i })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  it.each([
    ['expired', /has expired/i],
    ['revoked', /was revoked/i],
    ['claimed', /already been used/i],
  ] as const)('renders the %s dead-link state', async (status, copy) => {
    mocked.fetchInvitation.mockResolvedValue({ ...offer, status });
    renderPage();
    expect(await screen.findByText(copy)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /see plans/i })).toHaveAttribute(
      'href',
      '/billing?tab=plans',
    );
  });
});
