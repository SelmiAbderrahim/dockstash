import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { TooltipProvider } from '@shared/ui/tooltip';
import { ThemeProvider } from '@shared/theme/ThemeProvider';
import { i18n, initI18n } from '@shared/i18n';
import { MobileMenu, type MobileMenuLink } from './MobileMenu';

const LINKS: MobileMenuLink[] = [
  { to: '/pricing', label: 'Pricing', active: true },
  { to: '/guides', label: 'Guides', active: false },
];

const Navigator = () => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/guides')}>
      go-elsewhere
    </button>
  );
};

const renderMenu = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <TooltipProvider>
          <MemoryRouter initialEntries={['/pricing']}>
            <MobileMenu links={LINKS} />
            <Navigator />
          </MemoryRouter>
        </TooltipProvider>
      </ThemeProvider>
    </I18nextProvider>,
  );

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
});

afterEach(() => {
  cleanup();
});

describe('MobileMenu', () => {
  it('exposes a trigger button labelled by the menu string', () => {
    renderMenu();
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
  });

  it('opens a sheet with the links + login row when the trigger is clicked', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: /menu/i }));
    const dialog = await screen.findByRole('dialog');
    const pricing = within(dialog).getByRole('link', { name: 'Pricing' });
    expect(pricing).toHaveAttribute('aria-current', 'page');
    const guides = within(dialog).getByRole('link', { name: 'Guides' });
    expect(guides).not.toHaveAttribute('aria-current');
    expect(within(dialog).getByRole('link', { name: 'Log in' })).toBeInTheDocument();
  });

  it('closes on route change (link click within the sheet)', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: /menu/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('link', { name: 'Guides' }));
    // Sheet closes as onOpenChange fires. Route effect also flips open→false.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes when the login link inside the sheet is clicked', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: /menu/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('link', { name: 'Log in' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes when route changes via an external navigation', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: /menu/i }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByText('go-elsewhere'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
