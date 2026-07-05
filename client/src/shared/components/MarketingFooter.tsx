import { Link } from 'react-router-dom';
import { BrandLogo } from '@shared/brand';
import { cn } from '@shared/lib/utils';

export interface MarketingFooterColumn {
  ariaLabel: string;
  heading: string;
  links: { to: string; label: string }[];
}

interface MarketingFooterProps {
  tagline: string;
  copyright: string;
  columns: MarketingFooterColumn[];
  localeSwitcher: React.ReactNode;
}

const footerHeadingClass =
  'text-xs font-semibold uppercase tracking-wide text-foreground';
const footerLinkClass =
  'text-sm text-muted-foreground transition-colors hover:text-foreground';

const containerClass = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8';

/**
 * Shared marketing footer (G-09). Renders a `n+1`-column grid:
 * brand + tagline + one column per `columns` entry.
 */
export const MarketingFooter = ({
  tagline,
  copyright,
  columns,
  localeSwitcher,
}: MarketingFooterProps) => (
  <footer className="border-t py-12 text-muted-foreground">
    <div
      className={cn(containerClass, 'grid gap-8 sm:grid-cols-2')}
      style={{
        gridTemplateColumns: `repeat(${Math.max(columns.length + 1, 1)}, minmax(0, 1fr))`,
      }}
    >
      <div>
        <BrandLogo className="inline-flex items-center gap-2 font-bold text-foreground" />
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">{tagline}</p>
      </div>
      {columns.map((column) => (
        <nav
          key={column.heading}
          className="flex flex-col gap-2"
          aria-label={column.ariaLabel}
        >
          <h3 className={footerHeadingClass}>{column.heading}</h3>
          {column.links.map((link) => (
            <Link key={link.to} to={link.to} className={footerLinkClass}>
              {link.label}
            </Link>
          ))}
        </nav>
      ))}
    </div>
    <div
      className={cn(
        containerClass,
        'mt-10 flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between',
      )}
    >
      <p className="text-sm text-muted-foreground">{copyright}</p>
      {localeSwitcher}
    </div>
  </footer>
);
