import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@shared/hooks/redux';
import { selectAuthenticated } from '@features/auth';
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
import { ThemeToggle } from './ThemeToggle';

interface NavLink {
  to: string;
  label: string;
}

const AUTHED_LINKS: NavLink[] = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/projects', label: 'Projects' },
  { to: '/snapshots', label: 'Snapshots' },
  { to: '/settings', label: 'Settings' },
  { to: '/logout', label: 'Logout' },
];

const ANON_LINKS: NavLink[] = [
  { to: '/', label: 'Home' },
  { to: '/login', label: 'Login' },
  { to: '/register', label: 'Register' },
];

export const Header = () => {
  const authenticated = useAppSelector(selectAuthenticated);
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const links = authenticated ? AUTHED_LINKS : ANON_LINKS;

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 border-b backdrop-blur">
      <div className="container mx-auto flex h-14 items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center" aria-label="Dockstash home">
          <BrandLogo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Button key={link.to} asChild variant="ghost" size="sm">
              <Link to={link.to}>{link.label}</Link>
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
            <SheetContent side="right" className="w-64">
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
                    <Link to={link.to}>{link.label}</Link>
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
