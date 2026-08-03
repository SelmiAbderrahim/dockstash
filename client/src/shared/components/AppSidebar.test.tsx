import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { TooltipProvider } from '@shared/ui/tooltip';
import { ThemeProvider } from '@shared/theme/ThemeProvider';
import { SidebarProvider } from '@shared/ui/sidebar';
import { i18n, initI18n } from '@shared/i18n';
import { authReducer } from '@features/auth';
import { AppSidebar } from './AppSidebar';

const makeStore = (authenticated: boolean, role = '') =>
  configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: {
        authenticated,
        emailVerified: authenticated,
        role,
        pendingVerificationEmail: '',
        providers: { google: false, github: false },
        providersLoaded: false,
        error: '',
        message: '',
      },
    },
  });

const renderSidebar = (
  authenticated: boolean,
  role = '',
  initialEntry = '/dashboard',
) =>
  render(
    <Provider store={makeStore(authenticated, role)}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <TooltipProvider>
            <MemoryRouter initialEntries={[initialEntry]}>
              <SidebarProvider>
                <AppSidebar />
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

afterEach(async () => {
  // initI18n is init-once — undo any per-test changeLanguage explicitly.
  await i18n.changeLanguage('en');
});

describe('AppSidebar', () => {
  it('renders nothing for an anonymous visitor', () => {
    const { container } = renderSidebar(false);
    expect(container.querySelector('[data-slot="sidebar"]')).toBeNull();
  });

  it('anchors on the right for an RTL locale', async () => {
    await i18n.changeLanguage('ar');
    const { container } = renderSidebar(true);
    expect(container.querySelector('[data-side="right"]')).not.toBeNull();
  });

  it('renders the SPEC-02 groups for an authed Member', () => {
    renderSidebar(true);
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Backups')).toBeInTheDocument();
    // 'Fleet' appears as both a group label AND a nav item label:
    expect(screen.getAllByText('Fleet').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Account').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('link', { name: /Dashboard/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Projects/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Snapshots/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Settings/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Profile/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Logout/ })).toBeInTheDocument();
    // No admin item for a Member.
    expect(screen.queryByRole('link', { name: /^Admin$/ })).toBeNull();
  });

  it('keeps administrators on the same self-hosted product navigation', () => {
    renderSidebar(true, 'Admin');
    expect(screen.queryByRole('link', { name: /^Admin$/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Settings/ })).toBeInTheDocument();
  });

  it('marks the active route with the primary token', () => {
    renderSidebar(true, '', '/projects');
    const projects = screen.getByRole('link', { name: /Projects/ });
    // The active class carries bg-primary from the sidebar composition.
    expect(projects.closest('[data-active]')?.getAttribute('data-active')).toBe(
      'true',
    );
  });

  it('treats nested routes as active for the parent nav item', () => {
    renderSidebar(true, '', '/projects/abc');
    const projects = screen.getByRole('link', { name: /Projects/ });
    expect(projects.closest('[data-active]')?.getAttribute('data-active')).toBe(
      'true',
    );
  });
});
