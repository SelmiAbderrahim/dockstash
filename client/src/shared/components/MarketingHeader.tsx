import { Link } from 'react-router-dom';
import { BrandLogo } from '@shared/brand';
import { Button } from '@shared/ui/button';
import { cn } from '@shared/lib/utils';
import { ThemeToggle } from './ThemeToggle';

export interface MarketingNavItem {
  to: string;
  label: string;
  active: boolean;
  basePath: string;
}

interface MarketingHeaderProps {
  brandHref: string;
  loginLabel: string;
  ctaLabel: string;
  navLabel: string;
  nav: MarketingNavItem[];
  localeSwitcher: React.ReactNode;
  mobileMenu: React.ReactNode;
}

const navLinkClass =
  'text-muted-foreground transition-colors hover:text-foreground';

/**
 * Shared marketing top-nav (G-09 / shared-layout-system rule).
 * Composed by `MarketingLayout` (SSR marketing surface). Uses solid
 * `bg-background` (no translucent chrome — retires the pre-extraction
 * BAN-02 exception).
 */
export const MarketingHeader = ({
  brandHref,
  loginLabel,
  ctaLabel,
  navLabel,
  nav,
  localeSwitcher,
  mobileMenu,
}: MarketingHeaderProps) => (
  <header className="sticky top-0 z-10 border-b border-border bg-background">
    <div className="container relative mx-auto flex h-15 items-center gap-6 px-4">
      <Link
        to={brandHref}
        className="inline-flex items-center gap-2 font-bold text-foreground"
      >
        <BrandLogo />
      </Link>
      <nav className="hidden gap-5 md:flex" aria-label={navLabel}>
        {nav.map((item) => (
          <Link
            key={item.basePath}
            to={item.to}
            aria-current={item.active ? 'page' : undefined}
            className={cn(navLinkClass, item.active && 'font-medium text-foreground')}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="ms-auto flex items-center gap-2 sm:gap-4">
        <div className="hidden lg:flex">{localeSwitcher}</div>
        <div className="hidden md:block">
          <ThemeToggle />
        </div>
        <Link to="/login" className={cn(navLinkClass, 'hidden sm:inline')}>
          {loginLabel}
        </Link>
        <Button asChild>
          <Link to="/register">{ctaLabel}</Link>
        </Button>
      </div>
      {mobileMenu}
    </div>
  </header>
);
