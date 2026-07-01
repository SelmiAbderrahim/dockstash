import { LayoutDashboard, Users, CreditCard, Settings } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/ui/table';
import { Badge } from '@shared/ui/badge';

type AdminSection = {
  id: string;
  label: string;
  description: string;
  status: 'active' | 'pending';
  icon: typeof LayoutDashboard;
};

const sections: AdminSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'System overview and health',
    status: 'active',
    icon: LayoutDashboard,
  },
  {
    id: 'users',
    label: 'Users',
    description: 'Manage user accounts and roles',
    status: 'active',
    icon: Users,
  },
  {
    id: 'billing',
    label: 'Billing',
    description: 'Subscriptions and invoices',
    status: 'active',
    icon: CreditCard,
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Platform configuration',
    status: 'pending',
    icon: Settings,
  },
];

export const AdminDashboard = () => (
  <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Admin navigation</CardTitle>
        <CardDescription>
          Administrative sections available on this platform.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">Section</TableHead>
              <TableHead className="text-start">Description</TableHead>
              <TableHead className="text-start">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <TableRow key={section.id} data-testid={`admin-section-${section.id}`}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <Icon className="text-muted-foreground size-4" aria-hidden="true" />
                      {section.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {section.description}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={section.status === 'active' ? 'default' : 'secondary'}
                    >
                      {section.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>
);
