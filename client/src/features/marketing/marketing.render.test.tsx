import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { HelmetProvider } from 'react-helmet-async';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { marketingRoutes } from './routes';
import { i18n, initI18n } from '@shared/i18n';
import { ThemeProvider } from '@shared/theme/ThemeProvider';
import { COMPETITORS, SERVICE_GUIDE_SLUGS, USE_CASE_SLUGS } from './content';

const renderPath = (path: string) => {
  const router = createMemoryRouter(marketingRoutes, { initialEntries: [path] });
  return render(
    <I18nextProvider i18n={i18n}>
      <HelmetProvider>
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </HelmetProvider>
    </I18nextProvider>,
  );
};

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
});

afterEach(() => {
  cleanup();
});

const competitorSlugs = Object.values(COMPETITORS).map((c) => c.slug);

describe('marketing static pages', () => {
  it.each([
    ['/', 'Back Up Your'],
    ['/pricing', 'Simple pricing'],
    ['/alternatives', 'Dockstash alternatives'],
    ['/fleet-agents', /one dashboard/i],
    ['/continuous-backup', /five minutes/i],
    ['/backup-monitoring', /actually working/i],
    ['/mirror', /keep every version/i],
    ['/security', 'Security you can verify'],
    ['/faq', 'Frequently asked questions'],
    ['/privacy', 'Privacy Policy'],
    ['/terms', 'Terms of Service'],
    ['/guides', /guides/i],
    ['/compare/self-hosted-backup-vs-cloud-backup', /self-hosted/i],
  ])('renders %s', (path, needle) => {
    renderPath(path as string);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    if (typeof needle === 'string') {
      expect(screen.getAllByText(new RegExp(needle, 'i')).length).toBeGreaterThan(0);
    } else {
      expect(screen.getAllByText(needle).length).toBeGreaterThan(0);
    }
  });
});

describe('marketing competitor pages', () => {
  it.each(competitorSlugs)('renders the alternative page for %s', (slug) => {
    renderPath(`/alternatives/${slug}`);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it.each(competitorSlugs)('renders the vs page for %s', (slug) => {
    renderPath(`/vs/${slug}`);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});

describe('marketing guide + use-case pages', () => {
  it.each(SERVICE_GUIDE_SLUGS)('renders the guide page for %s', (slug) => {
    renderPath(`/guides/backup-${slug}-docker`);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it.each(USE_CASE_SLUGS)('renders the use-case page for %s', (slug) => {
    renderPath(`/backup/${slug}-docker`);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});

describe('marketing not-found branches', () => {
  it.each([
    ['/alternatives/does-not-exist', 'Alternative not found'],
    ['/vs/does-not-exist', 'Comparison not found'],
    ['/guides/backup-does-not-exist-docker', 'Guide not found'],
    ['/backup/does-not-exist-docker', 'Backup guide not found'],
  ])('%s renders the not-found state', (path, heading) => {
    renderPath(path as string);
    expect(screen.getByText(heading as string)).toBeInTheDocument();
  });

  it.each([['/definitely-not-a-page'], ['/fr/definitely-not-a-page']])(
    '%s renders the 404 catch-all with noindex',
    (path) => {
      renderPath(path as string);
      expect(
        screen.getByRole('heading', { level: 1, name: /does not exist/i }),
      ).toBeInTheDocument();
      expect(screen.getByText('404')).toBeInTheDocument();
    },
  );
});

describe('marketing localized branch', () => {
  it('renders localized (non-default locale) marketing routes with the prefix', () => {
    renderPath('/ar/pricing');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    // Localized nav links carry the /ar prefix.
    const home = screen.getAllByRole('link').find((a) => a.getAttribute('href') === '/ar');
    expect(home).toBeTruthy();
  });

  it('renders the localized home index', () => {
    renderPath('/ar');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});

describe('marketing i18n namespace under a locale prefix', () => {
  it('renders the translated pricing h1 through the marketing namespace on /fr/pricing', () => {
    renderPath('/fr/pricing');
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Une tarification simple pour des sauvegardes Docker vérifiées',
      }),
    ).toBeInTheDocument();
    // Regression guard: the English copy must not leak through the fallback.
    expect(
      screen.queryByText('Simple pricing for verified Docker backups'),
    ).not.toBeInTheDocument();
  });

  it('renders the Arabic hero through the marketing namespace on /ar', () => {
    renderPath('/ar');
    expect(screen.getByText(/بأكمله/)).toBeInTheDocument();
  });

  it('keeps untranslated guide pages English on /fr/guides/backup-postgres-docker', () => {
    renderPath('/fr/guides/backup-postgres-docker');
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /How to back up a PostgreSQL Docker container/,
      }),
    ).toBeInTheDocument();
  });
});

describe('MarketingLayout authenticated redirect', () => {
  it('redirects an authenticated visitor away from the landing page', () => {
    document.cookie = 'token=JWT abc; path=/';
    // At '/', the layout effect sees the token and navigates to /dashboard,
    // which is outside the marketing tree, so the landing hero is not shown.
    renderPath('/');
    expect(screen.queryByText(/Docker projects deserve backups/i)).not.toBeInTheDocument();
  });
});

describe('MarketingLayout active nav state', () => {
  const primaryNav = () => screen.getByRole('navigation', { name: 'Primary' });

  it('marks the exact-match nav item with aria-current', () => {
    renderPath('/pricing');
    expect(
      within(primaryNav()).getByRole('link', { name: 'Pricing' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(primaryNav()).getByRole('link', { name: 'Guides' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('marks the parent nav item active on child pages', () => {
    renderPath('/guides/backup-postgres-docker');
    expect(
      within(primaryNav()).getByRole('link', { name: 'Guides' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('maps /backup/* use-case pages to the Guides nav item', () => {
    renderPath('/backup/wordpress-docker');
    expect(
      within(primaryNav()).getByRole('link', { name: 'Guides' }),
    ).toHaveAttribute('aria-current', 'page');
  });
});

describe('Home page sections', () => {
  it('renders the terminal frame, stat strip, and comparison teaser', () => {
    const { container } = renderPath('/');
    expect(screen.getByText('dockstash — backup run')).toBeInTheDocument();
    expect(container.querySelector('dl')).not.toBeNull();
    expect(screen.getByText('AES-256')).toBeInTheDocument();
    const teaser = screen.getByRole('link', { name: /Compare all alternatives/i });
    expect(teaser).toHaveAttribute('href', '/alternatives');
    // Drill-report proof panel rows.
    expect(screen.getAllByText('drill passed')).toHaveLength(3);
  });
});

describe('Pricing billing period toggle', () => {
  it('defaults to monthly and switches figures on yearly', () => {
    renderPath('/pricing');
    const monthly = screen.getByRole('radio', { name: 'Monthly' });
    const yearly = screen.getByRole('radio', { name: /Yearly/ });
    expect(monthly).toHaveAttribute('aria-checked', 'true');
    expect(yearly).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('$9')).toBeInTheDocument();
    expect(screen.queryByText('$90')).not.toBeInTheDocument();

    fireEvent.click(yearly);
    expect(yearly).toHaveAttribute('aria-checked', 'true');
    expect(monthly).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('$90')).toBeInTheDocument();
    expect(screen.getByText('$290')).toBeInTheDocument();
    expect(screen.queryByText('$9')).not.toBeInTheDocument();
  });
});
