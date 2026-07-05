import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MenuIcon } from 'lucide-react';
import { Button } from '@shared/ui/button';
import { Separator } from '@shared/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@shared/ui/sheet';
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
 * Marketing mobile navigation — shared `Sheet` primitive (G-09 /
 * shared-layout-system rule). Retires the native `<details>` implementation
 * so app + marketing surfaces share one mobile-menu affordance and pass the
 * `Sheet` focus trap / escape-to-close a11y checks.
 */
export const MobileMenu = ({ links }: { links: MobileMenuLink[] }) => {
  const { t } = useMarketingT();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // Close on route change (parity with the old `<details>` behavior).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="md:hidden"
          aria-label={t('layout.menu')}
        >
          <MenuIcon aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle>{t('layout.navMobileLabel')}</SheetTitle>
        </SheetHeader>
        <nav
          className="flex flex-col gap-0.5 px-4"
          aria-label={t('layout.navMobileLabel')}
        >
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
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Separator className="my-3" />
          <Link
            to="/login"
            className="rounded-md px-3 py-2 text-base text-muted-foreground transition-colors hover:bg-muted/50"
            onClick={() => setOpen(false)}
          >
            {t('layout.login')}
          </Link>
          <div className="mt-3 flex items-center justify-between gap-3 px-3">
            <ThemeToggle />
            <MarketingLocaleSwitcher id="marketing-locale-switcher-menu" />
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
};
