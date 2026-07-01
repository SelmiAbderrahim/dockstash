import { Link } from 'react-router-dom';
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
  label: string;
  description: string;
}

const useUserRole = (): string | undefined => {
  const user = loadCookie<CookieUser>('user');
  return user?.role;
};

const BASE_DESTINATIONS: Destination[] = [
  {
    to: '/projects',
    label: 'Projects',
    description: 'Manage your projects and deployments.',
  },
  {
    to: '/snapshots',
    label: 'Snapshots',
    description: 'Browse and restore project snapshots.',
  },
  {
    to: '/settings',
    label: 'Settings',
    description: 'Configure your workspace and integrations.',
  },
  {
    to: '/billing',
    label: 'Billing',
    description: 'Review usage, plans, and invoices.',
  },
  {
    to: '/profile',
    label: 'Profile',
    description: 'View and update your account details.',
  },
];

const ADMIN_DESTINATION: Destination = {
  to: '/admin',
  label: 'Admin',
  description: 'Access administrative controls.',
};

/**
 * Authenticated landing. Surfaces the four product screens (Projects,
 * Snapshots, Settings, Billing) plus the admin entry for admins. No demo
 * "protected test route" — that placeholder was removed with the demo strip.
 */
export const Dashboard = () => {
  const role = useUserRole();
  const destinations =
    role === 'Admin' ? [...BASE_DESTINATIONS, ADMIN_DESTINATION] : BASE_DESTINATIONS;

  return (
    <div className="dashboard px-4 py-8">
      <h1 className="text-foreground mb-6 text-2xl font-semibold">Dashboard</h1>
      <nav className="dashboard-nav grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {destinations.map((destination) => (
          <Card key={destination.to} className="flex flex-col">
            <CardHeader>
              <CardTitle>{destination.label}</CardTitle>
              <CardDescription>{destination.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild className="w-full">
                <Link to={destination.to}>{destination.label}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </nav>
    </div>
  );
};
