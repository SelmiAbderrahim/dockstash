import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { TooltipProvider } from '@shared/ui/tooltip';
import { ThemeProvider } from '@shared/theme/ThemeProvider';
import { i18n, initI18n } from '@shared/i18n';
import { Header } from './Header';
import { Footer } from './Footer';
import { AppLayout } from './AppLayout';
import { authReducer } from '@features/auth';
import { routes, appShellRoutes } from '@app/routes';

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
});

const Shell = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>
    <ThemeProvider>
      <TooltipProvider>{children}</TooltipProvider>
    </ThemeProvider>
  </I18nextProvider>
);

const makeStore = (authenticated: boolean) =>
  configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: {
        authenticated,
        emailVerified: authenticated,
        role: '',
        otpChallengeId: '',
        pendingVerificationEmail: '',
        error: '',
        message: '',
      },
    },
  });

const renderWithAuth = (ui: React.ReactNode, authenticated: boolean) =>
  render(
    <Provider store={makeStore(authenticated)}>
      <MemoryRouter>
        <Shell>{ui}</Shell>
      </MemoryRouter>
    </Provider>,
  );

describe('Header', () => {
  it('shows the product nav for an authenticated user', () => {
    renderWithAuth(<Header />, true);
    expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Snapshots' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Logout' })).toBeInTheDocument();
  });

  it('shows login/register for an anonymous visitor', () => {
    renderWithAuth(<Header />, false);
    expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Register' })).toBeInTheDocument();
  });
});

describe('Footer', () => {
  it('renders the authenticated link set + copyright', () => {
    renderWithAuth(<Footer />, true);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText(/All Rights Reserved/)).toBeInTheDocument();
  });

  it('renders the anonymous link set', () => {
    renderWithAuth(<Footer />, false);
    expect(screen.getByRole('link', { name: 'Register' })).toBeInTheDocument();
  });
});

describe('AppLayout', () => {
  it('renders header, footer, and the routed outlet', () => {
    render(
      <Provider store={makeStore(false)}>
        <MemoryRouter initialEntries={['/x']}>
          <Shell>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/x" element={<div>OUTLET</div>} />
              </Route>
            </Routes>
          </Shell>
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByText('OUTLET')).toBeInTheDocument();
    expect(screen.getByText(/All Rights Reserved/)).toBeInTheDocument();
  });
});

describe('route tree', () => {
  it('composes marketing + app-shell routes', () => {
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
    expect(appShellRoutes[0]?.children?.length).toBeGreaterThan(0);
  });
});
