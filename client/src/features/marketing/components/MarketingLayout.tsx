import { useEffect } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { loadCookie } from '@shared/utils/cookies';
import { BrandLogo } from '@shared/brand';
import { cn } from '@shared/lib/utils';
import { Button } from '@shared/ui/button';
import { ThemeToggle } from '@shared/components/ThemeToggle';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import { Container, useMarketingT } from './shared';
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

const navLinkClass =
  'text-muted-foreground transition-colors hover:text-foreground';

/** Whether a top-nav item matches the current base path (incl. child pages). */
const isNavActive = (itemBasePath: string, basePath: string): boolean =>
  basePath === itemBasePath ||
  basePath.startsWith(`${itemBasePath}/`) ||
  // Use-case guide spokes live under /backup/* but belong to Guides.
  (itemBasePath === '/guides' && basePath.startsWith('/backup/'));

/**
 * Public marketing shell (header nav + footer). Sibling to the
 * authenticated AppLayout. Server-rendered for crawlers; on the client it
 * redirects an already-authenticated visitor from the landing page to the
 * dashboard (SSR always renders the landing page so bots see content).
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

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <Container className="relative flex h-15 items-center gap-6">
          <Link
            to={href('/')}
            className="inline-flex items-center gap-2 font-bold text-foreground"
          >
            <BrandLogo />
          </Link>
          <nav className="hidden gap-5 md:flex" aria-label={t('layout.navPrimaryLabel')}>
            {NAV.map((item) => {
              const active = isNavActive(item.basePath, basePath);
              return (
                <Link
                  key={item.basePath}
                  to={href(item.basePath)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    navLinkClass,
                    active && 'font-medium text-foreground',
                  )}
                >
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>
          <div className="ms-auto flex items-center gap-2 sm:gap-4">
            <MarketingLocaleSwitcher
              className="hidden lg:flex"
              id="marketing-locale-switcher-header"
            />
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
            <Link to="/login" className={cn(navLinkClass, 'hidden sm:inline')}>
              {t('layout.login')}
            </Link>
            <Button asChild>
              <Link to="/register">{t('layout.getStarted')}</Link>
            </Button>
          </div>
          <MobileMenu
            links={NAV.map((item) => ({
              to: href(item.basePath),
              label: t(item.labelKey),
              active: isNavActive(item.basePath, basePath),
            }))}
          />
        </Container>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t py-12 text-muted-foreground">
        <Container className="grid gap-8 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
          <div>
            <BrandLogo className="inline-flex items-center gap-2 font-bold text-foreground" />
            <p className="mt-3 max-w-prose text-sm text-muted-foreground">
              {t('layout.footer.tagline')}
            </p>
          </div>
          <nav className="flex flex-col gap-2" aria-label={t('layout.footer.product')}>
            <h3 className={footerHeadingClass}>{t('layout.footer.product')}</h3>
            <Link to={href('/pricing')} className={footerLinkClass}>{t('layout.footer.links.pricing')}</Link>
            <Link to={href('/security')} className={footerLinkClass}>{t('layout.footer.links.security')}</Link>
            <Link to={href('/faq')} className={footerLinkClass}>{t('layout.footer.links.faq')}</Link>
          </nav>
          <nav className="flex flex-col gap-2" aria-label={t('layout.footer.compare')}>
            <h3 className={footerHeadingClass}>{t('layout.footer.compare')}</h3>
            <Link to={href('/alternatives')} className={footerLinkClass}>{t('layout.footer.links.allAlternatives')}</Link>
            <Link to={href('/alternatives/backrest')} className={footerLinkClass}>
              {t('layout.footer.links.backrestAlternative')}
            </Link>
            <Link
              to={href('/compare/self-hosted-backup-vs-cloud-backup')}
              className={footerLinkClass}
            >
              {t('layout.footer.links.selfHostedVsCloud')}
            </Link>
          </nav>
          <nav className="flex flex-col gap-2" aria-label={t('layout.footer.guides')}>
            <h3 className={footerHeadingClass}>{t('layout.footer.guides')}</h3>
            <Link to={href('/guides')} className={footerLinkClass}>{t('layout.footer.links.allGuides')}</Link>
            <Link to={href('/guides/backup-postgres-docker')} className={footerLinkClass}>
              {t('layout.footer.links.backupPostgres')}
            </Link>
            <Link to={href('/backup/wordpress-docker')} className={footerLinkClass}>
              {t('layout.footer.links.backupWordpress')}
            </Link>
          </nav>
          <nav className="flex flex-col gap-2" aria-label={t('layout.footer.legal')}>
            <h3 className={footerHeadingClass}>{t('layout.footer.legal')}</h3>
            <Link to={href('/privacy')} className={footerLinkClass}>{t('layout.footer.links.privacy')}</Link>
            <Link to={href('/terms')} className={footerLinkClass}>{t('layout.footer.links.terms')}</Link>
          </nav>
        </Container>
        <Container className="mt-10 flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{t('layout.footer.copyright')}</p>
          <MarketingLocaleSwitcher id="marketing-locale-switcher-footer" />
        </Container>
      </footer>
    </div>
  );
};

const footerHeadingClass =
  'text-xs font-semibold uppercase tracking-wide text-foreground';
const footerLinkClass =
  'text-sm text-muted-foreground transition-colors hover:text-foreground';
