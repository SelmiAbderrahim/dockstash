import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@shared/ui/tooltip';
import { ThemeProvider } from '@shared/theme/ThemeProvider';
import { i18n, initI18n } from '@shared/i18n';
import { MarketingHeader, type MarketingNavItem } from './MarketingHeader';

const NAV: MarketingNavItem[] = [
  { basePath: '/pricing', to: '/pricing', label: 'Pricing', active: true },
  { basePath: '/guides', to: '/guides', label: 'Guides', active: false },
];

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
});

const renderHeader = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <TooltipProvider>
          <MemoryRouter>
            <MarketingHeader
              brandHref="/"
              loginLabel="Log in"
              ctaLabel="Get started"
              navLabel="Primary"
              nav={NAV}
              localeSwitcher={<span data-testid="ls">ls</span>}
              mobileMenu={<span data-testid="mm">mm</span>}
            />
          </MemoryRouter>
        </TooltipProvider>
      </ThemeProvider>
    </I18nextProvider>,
  );

describe('MarketingHeader', () => {
  it('renders nav items and marks the active one', () => {
    renderHeader();
    const pricing = screen.getByRole('link', { name: 'Pricing' });
    expect(pricing).toHaveAttribute('aria-current', 'page');
    const guides = screen.getByRole('link', { name: 'Guides' });
    expect(guides).not.toHaveAttribute('aria-current');
  });

  it('renders login + CTA + mobile menu slot', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get started' })).toBeInTheDocument();
    expect(screen.getByTestId('mm')).toBeInTheDocument();
    expect(screen.getByTestId('ls')).toBeInTheDocument();
  });
});
