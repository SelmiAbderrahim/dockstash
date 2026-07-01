import { useEffect } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { loadCookie } from '@shared/utils/cookies';
import { BrandLogo } from '@shared/brand';
import { cn } from '@shared/lib/utils';
import { Button } from '@shared/ui/button';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import { Container } from './shared';
import '../marketing.scss';

const NAV = [
  { basePath: '/alternatives', label: 'Alternatives' },
  { basePath: '/guides', label: 'Guides' },
  { basePath: '/security', label: 'Security' },
  { basePath: '/pricing', label: 'Pricing' },
];

const navLinkClass =
  'text-muted-foreground transition-colors hover:text-foreground';

/**
 * Public marketing shell (header nav + footer). Sibling to the
 * authenticated AppLayout. Server-rendered for crawlers; on the client it
 * redirects an already-authenticated visitor from the landing page to the
 * dashboard (SSR always renders the landing page so bots see content).
 */
export const MarketingLayout = () => {
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
        <Container className="flex h-15 items-center gap-6">
          <Link
            to={href('/')}
            className="inline-flex items-center gap-2 font-bold text-foreground"
          >
            <BrandLogo />
          </Link>
          <nav className="hidden gap-5 md:flex" aria-label="Primary">
            {NAV.map((item) => (
              <Link key={item.basePath} to={href(item.basePath)} className={navLinkClass}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2 sm:gap-4">
            <Link to="/login" className={cn(navLinkClass, 'hidden sm:inline')}>
              Log in
            </Link>
            <Button asChild>
              <Link to="/register">Get started</Link>
            </Button>
          </div>
          <details className="relative ms-2 md:hidden">
            <summary className="cursor-pointer list-none rounded-md border border-border px-2.5 py-1.5 text-sm marker:content-none [&::-webkit-details-marker]:hidden">
              Menu
            </summary>
            <div className="absolute end-0 z-20 mt-2 flex w-44 flex-col gap-0.5 rounded-lg border border-border bg-background p-2 shadow-md">
              {NAV.map((item) => (
                <Link
                  key={item.basePath}
                  to={href(item.basePath)}
                  className="rounded-md px-3 py-2 text-foreground hover:bg-muted"
                >
                  {item.label}
                </Link>
              ))}
              <Link to="/login" className="rounded-md px-3 py-2 text-foreground hover:bg-muted">
                Log in
              </Link>
            </div>
          </details>
        </Container>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="py-12 text-muted-foreground">
        <Container className="grid gap-8 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
          <div>
            <BrandLogo className="inline-flex items-center gap-2 font-bold text-foreground" />
            <p className="mt-3 max-w-prose text-sm text-muted-foreground">
              One-click, verified backups for any Docker project.
            </p>
          </div>
          <nav className="flex flex-col gap-2" aria-label="Product">
            <h3 className={footerHeadingClass}>Product</h3>
            <Link to={href('/pricing')} className={footerLinkClass}>Pricing</Link>
            <Link to={href('/security')} className={footerLinkClass}>Security</Link>
            <Link to={href('/faq')} className={footerLinkClass}>FAQ</Link>
          </nav>
          <nav className="flex flex-col gap-2" aria-label="Compare">
            <h3 className={footerHeadingClass}>Compare</h3>
            <Link to={href('/alternatives')} className={footerLinkClass}>All alternatives</Link>
            <Link to={href('/alternatives/backrest')} className={footerLinkClass}>
              Backrest alternative
            </Link>
            <Link
              to={href('/compare/self-hosted-backup-vs-cloud-backup')}
              className={footerLinkClass}
            >
              Self-hosted vs cloud
            </Link>
          </nav>
          <nav className="flex flex-col gap-2" aria-label="Guides">
            <h3 className={footerHeadingClass}>Guides</h3>
            <Link to={href('/guides')} className={footerLinkClass}>All guides</Link>
            <Link to={href('/guides/backup-postgres-docker')} className={footerLinkClass}>
              Back up Postgres
            </Link>
            <Link to={href('/backup/wordpress-docker')} className={footerLinkClass}>
              Back up WordPress
            </Link>
          </nav>
          <nav className="flex flex-col gap-2" aria-label="Legal">
            <h3 className={footerHeadingClass}>Legal</h3>
            <Link to={href('/privacy')} className={footerLinkClass}>Privacy Policy</Link>
            <Link to={href('/terms')} className={footerLinkClass}>Terms of Service</Link>
          </nav>
        </Container>
      </footer>
    </div>
  );
};

const footerHeadingClass =
  'text-xs font-semibold uppercase tracking-wide text-foreground';
const footerLinkClass =
  'text-sm text-muted-foreground transition-colors hover:text-foreground';
