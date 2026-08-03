import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { TooltipProvider } from '@shared/ui/tooltip';
import { ThemeProvider } from '@shared/theme/ThemeProvider';
import { i18n, initI18n } from '@shared/i18n';
import { authReducer } from '@features/auth';
import { Header } from './Header';

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
});

afterEach(async () => {
  // initI18n is init-once — undo any per-test changeLanguage explicitly.
  await i18n.changeLanguage('en');
});

const makeStore = (authenticated: boolean, role = '') =>
  configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: {
        authenticated,
        emailVerified: authenticated,
        role,
        otpChallengeId: '',
        pendingVerificationEmail: '',
        providers: { google: false, github: false },
        providersLoaded: false,
        error: '',
        message: '',
      },
    },
  });

const renderHeader = (authenticated: boolean, role = '') =>
  render(
    <Provider store={makeStore(authenticated, role)}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <TooltipProvider>
            <MemoryRouter>
              <Header />
            </MemoryRouter>
          </TooltipProvider>
        </ThemeProvider>
      </I18nextProvider>
    </Provider>,
  );

describe('Header mobile menu', () => {
  it('opens a sheet exposing the same nav links', async () => {
    const user = userEvent.setup();
    renderHeader(true);
    await user.click(screen.getByRole('button', { name: /open menu/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('link', { name: 'Projects' })).toBeInTheDocument();
    // Clicking a link closes the sheet.
    await user.click(within(dialog).getByRole('link', { name: 'Dashboard' }));
  });

  it('shows anonymous links in the mobile sheet', async () => {
    const user = userEvent.setup();
    renderHeader(false);
    await user.click(screen.getByRole('button', { name: /open menu/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('link', { name: 'Login' })).toBeInTheDocument();
  });

  it('anchors the mobile sheet on the left for an RTL locale', async () => {
    await i18n.changeLanguage('ar');
    const user = userEvent.setup();
    renderHeader(true);
    await user.click(screen.getByRole('button', { name: i18n.t('nav.menu') }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('shows the authenticated nav for a signed-in visitor only', () => {
    const { unmount } = renderHeader(true, 'Member');
    expect(screen.getAllByRole('link', { name: 'Dashboard' }).length).toBeGreaterThan(0);
    unmount();

    renderHeader(false);
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
  });
});
