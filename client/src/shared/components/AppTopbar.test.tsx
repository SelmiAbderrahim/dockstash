import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { TooltipProvider } from '@shared/ui/tooltip';
import { ThemeProvider } from '@shared/theme/ThemeProvider';
import { SidebarProvider } from '@shared/ui/sidebar';
import { i18n, initI18n } from '@shared/i18n';
import { authReducer } from '@features/auth';
import { AppTopbar } from './AppTopbar';

const makeStore = (role = '') =>
  configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: {
        authenticated: true,
        emailVerified: true,
        role,
        otpChallengeId: '',
        pendingVerificationEmail: '',
        error: '',
        message: '',
      },
    },
  });

const renderTopbar = (role = '', context?: React.ReactNode) =>
  render(
    <Provider store={makeStore(role)}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <TooltipProvider>
            <MemoryRouter>
              <SidebarProvider>
                <AppTopbar context={context} />
              </SidebarProvider>
            </MemoryRouter>
          </TooltipProvider>
        </ThemeProvider>
      </I18nextProvider>
    </Provider>,
  );

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
});

describe('AppTopbar', () => {
  it('renders a sidebar-toggle button with aria-label', () => {
    renderTopbar();
    expect(screen.getByRole('button', { name: /toggle sidebar/i })).toBeInTheDocument();
  });

  it('renders the account menu with Profile + Logout for a Member', async () => {
    const user = userEvent.setup();
    renderTopbar('Member');
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    const menu = await screen.findByRole('menu');
    expect(menu.textContent).toContain('Profile');
    expect(menu.textContent).toContain('Logout');
    // Neither admin nor superadmin surfaces on the Member menu:
    expect(screen.queryByRole('menuitem', { name: /admin/i })).toBeNull();
  });

  it('exposes the Admin link for role=Admin', async () => {
    const user = userEvent.setup();
    renderTopbar('Admin');
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    await screen.findByRole('menu');
    expect(screen.getByRole('menuitem', { name: /admin/i })).toBeInTheDocument();
  });

  it('exposes the Superadmin link for role=Superadmin', async () => {
    const user = userEvent.setup();
    renderTopbar('Superadmin');
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    const menu = await screen.findByRole('menu');
    expect(menu.textContent).toContain('Superadmin');
  });

  it('renders the caller-supplied context in the middle slot', () => {
    renderTopbar('', <span data-testid="ctx">Projects › Detail</span>);
    expect(screen.getByTestId('ctx')).toBeInTheDocument();
  });
});
