import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOutIcon, ShieldIcon, UserIcon } from 'lucide-react';
import { useAppSelector } from '@shared/hooks/redux';
import { selectUserRole } from '@features/auth';
import { Button } from '@shared/ui/button';
import { Separator } from '@shared/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@shared/ui/dropdown-menu';
import { SidebarTrigger } from '@shared/ui/sidebar';
import { LanguageSwitcher } from '@shared/i18n/LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';

/**
 * SPEC-03 topbar — sidebar collapse trigger, page context slot, right cluster
 * (ThemeToggle, LanguageSwitcher, avatar/account menu). Ships inside the app
 * sidebar shell only; marketing has its own top-nav (MarketingHeader).
 */
export const AppTopbar = ({ context }: { context?: React.ReactNode }) => {
  const { t } = useTranslation('common');
  const role = useAppSelector(selectUserRole);
  const canAdmin = role === 'Admin' || role === 'Superadmin';

  return (
    <header className="bg-background/95 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4">
      <SidebarTrigger aria-label={t('sidebar.toggle', 'Toggle sidebar')} />
      <Separator orientation="vertical" className="me-2 h-6" />
      <div className="flex-1 truncate text-sm text-muted-foreground">{context}</div>
      <div className="ms-auto flex items-center gap-1.5">
        <LanguageSwitcher className="hidden sm:block" />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('sidebar.accountMenu', 'Account menu')}
            >
              <UserIcon aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('sidebar.account', 'Account')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile">
                <UserIcon aria-hidden="true" className="size-4" />
                <span>{t('nav.profile')}</span>
              </Link>
            </DropdownMenuItem>
            {canAdmin ? (
              <DropdownMenuItem asChild>
                <Link to={role === 'Superadmin' ? '/superadmin' : '/admin'}>
                  <ShieldIcon aria-hidden="true" className="size-4" />
                  <span>
                    {role === 'Superadmin' ? t('nav.superadmin') : t('nav.admin')}
                  </span>
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/logout">
                <LogOutIcon aria-hidden="true" className="size-4" />
                <span>{t('nav.logout')}</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
