import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, useNavigate } from 'react-router-dom';
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
        <MemoryRouter initialEntries={['/pricing']}>
          <MobileMenu links={LINKS} />
          <Navigator />
        </MemoryRouter>
      </ThemeProvider>
    </I18nextProvider>,
  );

const getDetails = (): HTMLDetailsElement => {
  const details = document.querySelector('details');
  if (!details) throw new Error('details not rendered');
  return details;
};

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
});

afterEach(() => {
  cleanup();
});

describe('MobileMenu', () => {
  it('renders nav links with aria-current on the active one, plus Log in', () => {
    renderMenu();
    const pricing = screen.getByRole('link', { name: 'Pricing' });
    expect(pricing).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Guides' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
  });

  it('closes when the route changes', () => {
    renderMenu();
    const details = getDetails();
    details.open = true;
    fireEvent.click(screen.getByText('go-elsewhere'));
    expect(details.open).toBe(false);
  });

  it('closes on pointerdown outside, but not on pointerdown inside', () => {
    renderMenu();
    const details = getDetails();

    details.open = true;
    fireEvent.pointerDown(screen.getByRole('link', { name: 'Guides' }));
    expect(details.open).toBe(true);

    fireEvent.pointerDown(document.body);
    expect(details.open).toBe(false);
  });
});
