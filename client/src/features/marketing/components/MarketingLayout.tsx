import { useEffect } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { loadCookie } from '@shared/utils/cookies';
import { BrandLogo } from '@shared/brand';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import '../marketing.scss';

const NAV = [
  { basePath: '/alternatives', label: 'Alternatives' },
  { basePath: '/guides', label: 'Guides' },
  { basePath: '/security', label: 'Security' },
  { basePath: '/pricing', label: 'Pricing' },
];

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
    <div className="mk">
      <header className="mk-header">
        <div className="mk-container mk-header__inner">
          <Link to={href('/')} className="mk-logo">
            <BrandLogo />
          </Link>
          <nav className="mk-nav" aria-label="Primary">
            {NAV.map((item) => (
              <Link key={item.basePath} to={href(item.basePath)}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mk-header__cta">
            <Link to="/login" className="mk-link-muted">
              Log in
            </Link>
            <Link to="/register" className="mk-btn mk-btn--primary">
              Get started
            </Link>
          </div>
          <details className="mk-nav-mobile">
            <summary aria-label="Open menu">Menu</summary>
            <div className="mk-nav-mobile__panel">
              {NAV.map((item) => (
                <Link key={item.basePath} to={href(item.basePath)}>
                  {item.label}
                </Link>
              ))}
              <Link to="/login">Log in</Link>
            </div>
          </details>
        </div>
      </header>

      <main className="mk-main">
        <Outlet />
      </main>

      <footer className="mk-footer">
        <div className="mk-container mk-footer__grid">
          <div>
            <BrandLogo className="mk-logo" />
            <p className="mk-muted">
              One-click, verified backups for any Docker project.
            </p>
          </div>
          <nav aria-label="Product">
            <h3>Product</h3>
            <Link to={href('/pricing')}>Pricing</Link>
            <Link to={href('/security')}>Security</Link>
            <Link to={href('/faq')}>FAQ</Link>
          </nav>
          <nav aria-label="Compare">
            <h3>Compare</h3>
            <Link to={href('/alternatives')}>All alternatives</Link>
            <Link to={href('/alternatives/backrest')}>Backrest alternative</Link>
            <Link to={href('/compare/self-hosted-backup-vs-cloud-backup')}>
              Self-hosted vs cloud
            </Link>
          </nav>
          <nav aria-label="Guides">
            <h3>Guides</h3>
            <Link to={href('/guides')}>All guides</Link>
            <Link to={href('/guides/backup-postgres-docker')}>
              Back up Postgres
            </Link>
            <Link to={href('/backup/wordpress-docker')}>Back up WordPress</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};
