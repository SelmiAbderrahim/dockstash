import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MenuIcon } from 'lucide-react';
import { Separator } from '@shared/ui/separator';
import { ThemeToggle } from '@shared/components/ThemeToggle';
import { cn } from '@shared/lib/utils';
import { MarketingLocaleSwitcher } from './MarketingLocaleSwitcher';
import { useMarketingT } from './shared';

export interface MobileMenuLink {
  to: string;
  label: string;
  active: boolean;
}

/**
 * Mobile navigation for the marketing header. Kept as a native
 * `<details>`/`<summary>` so it server-renders and toggles pre-hydration;
 * the post-hydration effects only add polish (close on route change and on
 * outside pointerdown). The header supplies `relative` positioning context
 * for the full-width panel.
 */
export const MobileMenu = ({ links }: { links: MobileMenuLink[] }) => {
  const { t } = useMarketingT();
  const ref = useRef<HTMLDetailsElement>(null);
  const { pathname } = useLocation();

  // Close the panel when navigation happens (link click → route change).
  useEffect(() => {
    /* v8 ignore next -- the <details> is always mounted with the ref attached */
    ref.current?.removeAttribute('open');
  }, [pathname]);

  // Close on pointerdown outside the menu (client-only, added post-hydration).
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const el = ref.current;
      /* v8 ignore next -- the <details> is always mounted with the ref attached */
      if (!el) return;
      if (!el.contains(event.target as Node)) {
        el.removeAttribute('open');
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return (
    <details ref={ref} className="md:hidden">
      <summary
        aria-label={t('layout.menu')}
        className="inline-flex size-9 cursor-pointer list-none items-center justify-center rounded-md border marker:content-none [&::-webkit-details-marker]:hidden"
      >
        <MenuIcon aria-hidden="true" className="size-5" />
      </summary>
      <div className="absolute inset-x-0 top-full z-20 border-b bg-background p-4">
        <nav className="flex flex-col gap-0.5" aria-label={t('layout.navMobileLabel')}>
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              aria-current={link.active ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-2 text-base transition-colors hover:bg-muted/50',
                link.active
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Separator className="my-3" />
        <Link
          to="/login"
          className="block rounded-md px-3 py-2 text-base text-muted-foreground transition-colors hover:bg-muted/50"
        >
          {t('layout.login')}
        </Link>
        <div className="mt-3 flex items-center justify-between gap-3 px-3">
          <ThemeToggle />
          <MarketingLocaleSwitcher id="marketing-locale-switcher-menu" />
        </div>
      </div>
    </details>
  );
};
