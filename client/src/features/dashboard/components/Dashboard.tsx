import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/ui/card';
import { Button } from '@shared/ui/button';

interface Destination {
  to: string;
  labelKey: string;
  descriptionKey: string;
}

const BASE_DESTINATIONS: Destination[] = [
  { to: '/projects', labelKey: 'nav.projects', descriptionKey: 'dashboard.projects' },
  { to: '/snapshots', labelKey: 'nav.snapshots', descriptionKey: 'dashboard.snapshots' },
  { to: '/settings', labelKey: 'nav.settings', descriptionKey: 'dashboard.settings' },
  { to: '/profile', labelKey: 'nav.profile', descriptionKey: 'dashboard.profile' },
];

/**
 * Authenticated landing for the four product screens. Admin-only recovery
 * operations live in Settings; there is no separate platform console.
 */
export const Dashboard = () => {
  const { t } = useTranslation('common');

  return (
    <div className="dashboard px-4 py-8">
      <h1 className="text-foreground mb-6 text-2xl font-semibold">{t('nav.dashboard')}</h1>
      <nav className="dashboard-nav grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BASE_DESTINATIONS.map((destination) => (
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
