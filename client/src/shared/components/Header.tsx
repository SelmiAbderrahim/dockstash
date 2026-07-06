import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@shared/hooks/redux';
import { selectAuthenticated, selectUserRole } from '@features/auth';
import { BrandLogo } from '@shared/brand';
import { Button } from '@shared/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@shared/ui/sheet';
import { LanguageSwitcher } from '@shared/i18n/LanguageSwitcher';
import { isRtl } from '@shared/i18n';
import { ThemeToggle } from './ThemeToggle';

interface NavLink {
  to: string;
  labelKey: string;
}

const AUTHED_LINKS: NavLink[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard' },
  { to: '/projects', labelKey: 'nav.projects' },
  { to: '/snapshots', labelKey: 'nav.snapshots' },
  { to: '/fleet', labelKey: 'nav.fleet' },
  { to: '/settings', labelKey: 'nav.settings' },
  { to: '/logout', labelKey: 'nav.logout' },
];

const SUPERADMIN_LINK: NavLink = { to: '/superadmin', labelKey: 'nav.superadmin' };

const ANON_LINKS: NavLink[] = [
  { to: '/', labelKey: 'nav.home' },
  { to: '/login', labelKey: 'nav.login' },
  { to: '/register', labelKey: 'nav.register' },
];

export const Header = () => {
  const authenticated = useAppSelector(selectAuthenticated);
  const role = useAppSelector(selectUserRole);
  const { t, i18n } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const authedLinks =
    role === 'Superadmin' ? [SUPERADMIN_LINK, ...AUTHED_LINKS] : AUTHED_LINKS;
  const links = authenticated ? authedLinks : ANON_LINKS;

  return (
    <header className="bg-background sticky top-0 z-40 border-b">
      <div className="container mx-auto flex h-14 items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center" aria-label="Dockstash home">
          <BrandLogo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Button key={link.to} asChild variant="ghost" size="sm">
              <Link to={link.to}>{t(link.labelKey)}</Link>
            </Button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher className="hidden sm:block" />
          <ThemeToggle />

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label={t('nav.menu', 'Open menu')}
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side={isRtl(i18n.language) ? 'left' : 'right'} className="w-64">
              <SheetHeader>
                <SheetTitle>
                  <BrandLogo />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-2">
                {links.map((link) => (
                  <Button
                    key={link.to}
                    asChild
                    variant="ghost"
                    className="justify-start"
                    onClick={() => setOpen(false)}
                  >
                    <Link to={link.to}>{t(link.labelKey)}</Link>
                  </Button>
                ))}
                <LanguageSwitcher className="mt-2 px-2 sm:hidden" />
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};
