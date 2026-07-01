import { beforeEach, describe, expect, it } from 'vitest';
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

const makeStore = (authenticated: boolean) =>
  configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: {
        authenticated,
        emailVerified: authenticated,
        pendingVerificationEmail: '',
        error: '',
        message: '',
      },
    },
  });

const renderHeader = (authenticated: boolean) =>
  render(
    <Provider store={makeStore(authenticated)}>
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
});
