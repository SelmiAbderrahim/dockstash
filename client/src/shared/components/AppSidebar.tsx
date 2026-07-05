import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import {
  ArchiveIcon,
  CreditCardIcon,
  FolderIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  ServerIcon,
  SettingsIcon,
  ShieldIcon,
  UserIcon,
} from 'lucide-react';
import { useAppSelector } from '@shared/hooks/redux';
import { selectAuthenticated, selectUserRole } from '@features/auth';
import { BrandLogo } from '@shared/brand';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@shared/ui/sidebar';
import { cn } from '@shared/lib/utils';

interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

interface NavGroup {
  labelKey: string;
  items: NavItem[];
  role?: 'Superadmin' | 'Admin';
}

/** SPEC-02 grouped nav — labels resolved via `t('sidebar.groups.*'|'nav.*')`. */
const GROUPS: NavGroup[] = [
  {
    labelKey: 'sidebar.groups.overview',
    items: [{ to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboardIcon }],
  },
  {
    labelKey: 'sidebar.groups.backups',
    items: [
      { to: '/projects', labelKey: 'nav.projects', icon: FolderIcon },
      { to: '/snapshots', labelKey: 'nav.snapshots', icon: ArchiveIcon },
    ],
  },
  {
    labelKey: 'sidebar.groups.fleet',
    items: [{ to: '/fleet', labelKey: 'nav.fleet', icon: ServerIcon }],
  },
  {
    labelKey: 'sidebar.groups.account',
    items: [
      { to: '/billing', labelKey: 'nav.billing', icon: CreditCardIcon },
      { to: '/settings', labelKey: 'nav.settings', icon: SettingsIcon },
      { to: '/profile', labelKey: 'nav.profile', icon: UserIcon },
    ],
  },
  {
    labelKey: 'sidebar.groups.admin',
    role: 'Admin',
    items: [{ to: '/admin', labelKey: 'nav.admin', icon: ShieldIcon }],
  },
  {
    labelKey: 'sidebar.groups.admin',
    role: 'Superadmin',
    items: [{ to: '/superadmin', labelKey: 'nav.superadmin', icon: ShieldIcon }],
  },
];

const isRouteActive = (pathname: string, target: string): boolean =>
  pathname === target || pathname.startsWith(`${target}/`);

/** SPEC-02 sidebar — grouped nav + role-gated admin block, brand mark up top. */
export const AppSidebar = () => {
  const authenticated = useAppSelector(selectAuthenticated);
  const role = useAppSelector(selectUserRole);
  const { t } = useTranslation('common');
  const { pathname } = useLocation();

  if (!authenticated) return null;

  const visibleGroups = GROUPS.filter((group) => {
    if (!group.role) return true;
    if (group.role === 'Superadmin') return role === 'Superadmin';
    return role === 'Admin' || role === 'Superadmin';
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          to="/dashboard"
          aria-label={t('sidebar.brandLink', 'Dockstash home')}
          className="flex items-center gap-2 px-2 py-1"
        >
          <BrandLogo />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {visibleGroups.map((group, i) => (
          <SidebarGroup key={`${group.labelKey}-${i}`}>
            <SidebarGroupLabel>{t(group.labelKey)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isRouteActive(pathname, item.to);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={t(item.labelKey)}
                        className={cn(
                          active &&
                            'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
                        )}
                      >
                        <Link to={item.to}>
                          <item.icon aria-hidden="true" className="size-4" />
                          <span>{t(item.labelKey)}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={t('nav.logout')}>
              <Link to="/logout">
                <LogOutIcon aria-hidden="true" className="size-4" />
                <span>{t('nav.logout')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
