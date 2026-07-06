import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { loadCookie } from '@shared/utils/cookies';
import { MarketingHeader, type MarketingNavItem } from '@shared/components/MarketingHeader';
import { MarketingFooter } from '@shared/components/MarketingFooter';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import { useMarketingT } from './shared';
import { MobileMenu } from './MobileMenu';
import { MarketingLocaleSwitcher } from './MarketingLocaleSwitcher';
import '../marketing.scss';

/** Nav inventory: hrefs stay in TSX; labels resolve via `layout.nav.*`. */
const NAV = [
  { basePath: '/alternatives', labelKey: 'layout.nav.alternatives' },
  { basePath: '/guides', labelKey: 'layout.nav.guides' },
  { basePath: '/security', labelKey: 'layout.nav.security' },
  { basePath: '/pricing', labelKey: 'layout.nav.pricing' },
];

/** Whether a top-nav item matches the current base path (incl. child pages). */
const isNavActive = (itemBasePath: string, basePath: string): boolean =>
  basePath === itemBasePath ||
  basePath.startsWith(`${itemBasePath}/`) ||
  // Use-case guide spokes live under /backup/* but belong to Guides.
  (itemBasePath === '/guides' && basePath.startsWith('/backup/'));

/**
 * Public marketing shell (header nav + footer). Sibling to the
 * authenticated AppLayout — both compose shared `MarketingHeader`/
 * `MarketingFooter` primitives (G-09 / shared-layout-system rule).
 * Server-rendered for crawlers; on the client an already-authenticated
 * visitor is redirected from the landing page to the dashboard.
 */
export const MarketingLayout = () => {
  const { t } = useMarketingT();
  const { locale, basePath } = useMarketingRoute();
  const navigate = useNavigate();

  useEffect(() => {
    if (basePath === '/' && loadCookie<string>('token')) {
      navigate('/dashboard', { replace: true });
    }
  }, [basePath, navigate]);

  const href = (path: string) => localeHref(path, locale);

  const nav: MarketingNavItem[] = NAV.map((item) => ({
    basePath: item.basePath,
    to: href(item.basePath),
    label: t(item.labelKey),
    active: isNavActive(item.basePath, basePath),
  }));

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <MarketingHeader
        brandHref={href('/')}
        loginLabel={t('layout.login')}
        ctaLabel={t('layout.getStarted')}
        navLabel={t('layout.navPrimaryLabel')}
        nav={nav}
        localeSwitcher={
          <MarketingLocaleSwitcher id="marketing-locale-switcher-header" />
        }
        mobileMenu={<MobileMenu links={nav} />}
      />

      <main className="flex-1">
        <Outlet />
      </main>

      <MarketingFooter
        tagline={t('layout.footer.tagline')}
        copyright={t('layout.footer.copyright')}
        localeSwitcher={
          <MarketingLocaleSwitcher id="marketing-locale-switcher-footer" />
        }
        columns={[
          {
            ariaLabel: t('layout.footer.product'),
            heading: t('layout.footer.product'),
            links: [
              { to: href('/pricing'), label: t('layout.footer.links.pricing') },
              {
                to: href('/continuous-backup'),
                label: t('layout.footer.links.continuousBackup'),
              },
              {
                to: href('/backup-monitoring'),
                label: t('layout.footer.links.backupMonitoring'),
              },
              { to: href('/mirror'), label: t('layout.footer.links.mirror') },
              { to: href('/security'), label: t('layout.footer.links.security') },
              { to: href('/faq'), label: t('layout.footer.links.faq') },
            ],
          },
          {
            ariaLabel: t('layout.footer.compare'),
            heading: t('layout.footer.compare'),
            links: [
              {
                to: href('/alternatives'),
                label: t('layout.footer.links.allAlternatives'),
              },
              {
                to: href('/alternatives/backrest'),
                label: t('layout.footer.links.backrestAlternative'),
              },
              {
                to: href('/compare/self-hosted-backup-vs-cloud-backup'),
                label: t('layout.footer.links.selfHostedVsCloud'),
              },
            ],
          },
          {
            ariaLabel: t('layout.footer.guides'),
            heading: t('layout.footer.guides'),
            links: [
              { to: href('/guides'), label: t('layout.footer.links.allGuides') },
              {
                to: href('/guides/backup-postgres-docker'),
                label: t('layout.footer.links.backupPostgres'),
              },
              {
                to: href('/backup/wordpress-docker'),
                label: t('layout.footer.links.backupWordpress'),
              },
            ],
          },
          {
            ariaLabel: t('layout.footer.legal'),
            heading: t('layout.footer.legal'),
            links: [
              { to: href('/privacy'), label: t('layout.footer.links.privacy') },
              { to: href('/terms'), label: t('layout.footer.links.terms') },
            ],
          },
        ]}
      />
    </div>
  );
};
