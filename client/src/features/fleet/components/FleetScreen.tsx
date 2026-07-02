import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Lock, MoreHorizontal, Plus } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@shared/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@shared/ui/alert-dialog';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@shared/ui/empty';
import { selectActiveStepTarget } from '@features/guide';
import { deleteAgent, fetchFleet } from '../store/thunks';
import {
  selectFleet,
  selectFleetError,
  selectFleetLockedReason,
  selectFleetStatus,
} from '../store/selectors';
import { RegisterAgentDialog } from './RegisterAgentDialog';
import { AgentSetupDialog } from './AgentSetupDialog';
import type { FleetEntry } from '../types';

/** Background refresh cadence — matches a heartbeat-driven online/offline flip. */
const POLL_INTERVAL_MS = 30_000;

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

/**
 * Guide-tour anchors that live inside `RegisterAgentDialog`. When the tour lands
 * on one of these steps the dialog must be open, otherwise the anchor never
 * mounts and the overlay shows "This element isn't visible right now."
 */
const DIALOG_TOUR_ANCHORS = [
  'agent-name-input',
  'agent-host-input',
  'agent-port-input',
  'agent-register-submit',
];

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
  const [setupAgent, setSetupAgent] = useState<FleetEntry | null>(null);
  const [removeAgent, setRemoveAgent] = useState<FleetEntry | null>(null);
  const activeStepTarget = useAppSelector(selectActiveStepTarget);

  useEffect(() => {
    void dispatch(fetchFleet());
  }, [dispatch]);

  // Silent background poll so online/offline status stays fresh without the
  // table flashing skeletons (the slice keeps last-good data on a silent tick).
  useEffect(() => {
    const id = setInterval(() => {
      void dispatch(fetchFleet({ silent: true }));
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [dispatch]);

  const confirmRemove = () => {
    // Defensive only: the confirm action lives inside the `removeAgent !== null`
    // branch of the AlertDialog below, so `removeAgent` is always set when this runs.
    /* v8 ignore next */
    if (!removeAgent) return;
    void dispatch(deleteAgent(removeAgent.id));
    setRemoveAgent(null);
  };

  // Open the register dialog when the guide tour targets one of its fields, so
  // the anchor exists no matter how the user reached the step (Next, Back,
  // "Take me there", resume). Open-only — a manual close is respected.
  useEffect(() => {
    if (activeStepTarget && DIALOG_TOUR_ANCHORS.includes(activeStepTarget)) {
      setRegisterOpen(true);
    }
  }, [activeStepTarget]);

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
                <TableHead data-tour="fleet-table-status" className="text-start">
                  {t('fleet.table.status')}
                </TableHead>
                <TableHead className="text-start">{t('fleet.table.lastSeen')}</TableHead>
                <TableHead className="text-end">{t('fleet.table.projects')}</TableHead>
                <TableHead className="text-end">{t('fleet.table.size')}</TableHead>
                <TableHead className="text-end">{t('fleet.table.snapshots')}</TableHead>
                <TableHead className="text-end">
                  <span className="sr-only">{t('fleet.table.actions')}</span>
                </TableHead>
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
                  <TableCell className="text-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={t('fleet.actions.aria')}>
                          <MoreHorizontal className="size-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setSetupAgent(entry)}>
                          {t('fleet.actions.setup')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setSetupAgent(entry)}>
                          {t('fleet.actions.rotate')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setRemoveAgent(entry)}
                        >
                          {t('fleet.actions.remove')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RegisterAgentDialog open={registerOpen} onClose={() => setRegisterOpen(false)} />
      <AgentSetupDialog agent={setupAgent} onClose={() => setSetupAgent(null)} />
      <AlertDialog open={removeAgent !== null} onOpenChange={(open) => !open && setRemoveAgent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('fleet.remove.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('fleet.remove.description', { name: removeAgent?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('fleet.remove.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>{t('fleet.remove.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
