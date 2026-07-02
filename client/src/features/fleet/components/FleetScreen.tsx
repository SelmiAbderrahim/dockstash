import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Lock, Plus } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Skeleton } from '@shared/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/ui/table';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@shared/ui/empty';
import { fetchFleet } from '../store/thunks';
import {
  selectFleet,
  selectFleetError,
  selectFleetLockedReason,
  selectFleetStatus,
} from '../store/selectors';
import { RegisterAgentDialog } from './RegisterAgentDialog';
import type { FleetEntry } from '../types';

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

const StatusBadge = ({ status }: { status: FleetEntry['status'] }) => {
  const { t } = useTranslation('common');
  return (
    <Badge
      variant={status === 'online' ? 'outline' : 'secondary'}
      data-status={status}
    >
      {status === 'online' && (
        <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
      )}
      {t(`fleet.status.${status}`)}
    </Badge>
  );
};

export const FleetScreen = () => {
  const { t, i18n } = useTranslation('common');
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectFleet);
  const status = useAppSelector(selectFleetStatus);
  const error = useAppSelector(selectFleetError);
  const lockedReason = useAppSelector(selectFleetLockedReason);

  const [registerOpen, setRegisterOpen] = useState(false);

  useEffect(() => {
    void dispatch(fetchFleet());
  }, [dispatch]);

  const locked = lockedReason === 'multiVpsLocked';

  return (
    <section
      className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6"
      aria-labelledby="fleet-heading"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1 text-start">
          <h1
            id="fleet-heading"
            data-tour="fleet-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            {t('fleet.heading')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('fleet.lede')}</p>
        </div>
        {!locked && (
          <Button type="button" data-tour="fleet-register-button" onClick={() => setRegisterOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            {t('fleet.register')}
          </Button>
        )}
      </header>

      {status === 'loading' && (
        <div role="status" aria-live="polite" className="flex flex-col gap-3">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t('fleet.loading')}
          </span>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      )}

      {locked && (
        <Card data-testid="fleet-locked">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
              {t('fleet.locked.title')}
            </CardTitle>
            <CardDescription>{t('fleet.locked.body')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/billing">{t('fleet.locked.cta')}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {status === 'failed' && !locked && (
        <Alert variant="destructive">
          <AlertDescription>{error ?? t('fleet.errors.load')}</AlertDescription>
        </Alert>
      )}

      {status === 'succeeded' && items.length === 0 && (
        <Empty data-testid="fleet-empty">
          <EmptyHeader>
            <EmptyTitle>{t('fleet.empty.title')}</EmptyTitle>
            <EmptyDescription>{t('fleet.empty.hint')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" onClick={() => setRegisterOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              {t('fleet.register')}
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {items.length > 0 && (
        <div className="rounded-lg border">
          <Table aria-label={t('fleet.table.aria')}>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">{t('fleet.table.name')}</TableHead>
                <TableHead className="text-start">{t('fleet.table.host')}</TableHead>
                <TableHead className="text-start">{t('fleet.table.status')}</TableHead>
                <TableHead className="text-start">{t('fleet.table.lastSeen')}</TableHead>
                <TableHead className="text-end">{t('fleet.table.projects')}</TableHead>
                <TableHead className="text-end">{t('fleet.table.size')}</TableHead>
                <TableHead className="text-end">{t('fleet.table.snapshots')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.name}</TableCell>
                  <TableCell className="font-mono text-xs">{entry.host}</TableCell>
                  <TableCell>
                    <StatusBadge status={entry.status} />
                  </TableCell>
                  <TableCell>
                    {entry.lastSeenAt
                      ? new Date(entry.lastSeenAt).toLocaleString(i18n.language)
                      : t('fleet.never')}
                  </TableCell>
                  <TableCell className="text-end">{entry.projectCount}</TableCell>
                  <TableCell className="text-end">{formatBytes(entry.totalBytes)}</TableCell>
                  <TableCell className="text-end">{entry.snapshotCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RegisterAgentDialog open={registerOpen} onClose={() => setRegisterOpen(false)} />
    </section>
  );
};
