import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { HelmetProvider } from 'react-helmet-async';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { marketingRoutes } from './routes';
import { i18n, initI18n } from '@shared/i18n';
import { COMPETITORS, SERVICE_GUIDE_SLUGS, USE_CASE_SLUGS } from './content';

const renderPath = (path: string) => {
  const router = createMemoryRouter(marketingRoutes, { initialEntries: [path] });
  return render(
    <I18nextProvider i18n={i18n}>
      <HelmetProvider>
        <RouterProvider router={router} />
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

describe('MarketingLayout authenticated redirect', () => {
  it('redirects an authenticated visitor away from the landing page', () => {
    document.cookie = 'token=JWT abc; path=/';
    // At '/', the layout effect sees the token and navigates to /dashboard,
    // which is outside the marketing tree, so the landing hero is not shown.
    renderPath('/');
    expect(screen.queryByText(/Docker projects deserve backups/i)).not.toBeInTheDocument();
  });
});
