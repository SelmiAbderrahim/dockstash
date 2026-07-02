import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@shared/ui/card';

interface StatTileProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
}

export const StatTile = ({ label, value, icon: Icon }: StatTileProps) => (
  <Card className="shadow-xs">
    <CardContent className="flex items-center gap-3 py-4">
      <span className="flex size-9 items-center justify-center rounded-md border">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="flex flex-col">
        <span className="text-muted-foreground text-sm">{label}</span>
        <span className="text-2xl font-semibold text-foreground">{value}</span>
      </span>
    </CardContent>
  </Card>
);
