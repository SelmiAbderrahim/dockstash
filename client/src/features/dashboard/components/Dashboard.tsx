import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loadCookie } from '@shared/utils/cookies';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/ui/card';
import { Button } from '@shared/ui/button';

interface CookieUser {
  role?: string;
}

interface Destination {
  to: string;
  labelKey: string;
  descriptionKey: string;
}

const useUserRole = (): string | undefined => {
  const user = loadCookie<CookieUser>('user');
  return user?.role;
};

const BASE_DESTINATIONS: Destination[] = [
  { to: '/projects', labelKey: 'nav.projects', descriptionKey: 'dashboard.projects' },
  { to: '/snapshots', labelKey: 'nav.snapshots', descriptionKey: 'dashboard.snapshots' },
  { to: '/settings', labelKey: 'nav.settings', descriptionKey: 'dashboard.settings' },
  { to: '/profile', labelKey: 'nav.profile', descriptionKey: 'dashboard.profile' },
];

const ADMIN_DESTINATION: Destination = {
  to: '/admin',
  labelKey: 'nav.admin',
  descriptionKey: 'dashboard.admin',
};

/**
 * Authenticated landing. Surfaces the four product screens (Projects,
 * Snapshots, Settings) plus the admin entry for admins. No demo
 * "protected test route" — that placeholder was removed with the demo strip.
 */
export const Dashboard = () => {
  const role = useUserRole();
  const { t } = useTranslation('common');
  const destinations =
    role === 'Admin' ? [...BASE_DESTINATIONS, ADMIN_DESTINATION] : BASE_DESTINATIONS;

  return (
    <div className="dashboard px-4 py-8">
      <h1 className="text-foreground mb-6 text-2xl font-semibold">{t('nav.dashboard')}</h1>
      <nav className="dashboard-nav grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {destinations.map((destination) => (
          <Card key={destination.to} className="flex flex-col">
            <CardHeader>
              <CardTitle>{t(destination.labelKey)}</CardTitle>
              <CardDescription>{t(destination.descriptionKey)}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild className="w-full">
                <Link to={destination.to}>{t(destination.labelKey)}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </nav>
    </div>
  );
};
