import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  Circle,
  FolderGit2,
  Loader2,
  Mail,
  Server,
  TriangleAlert,
  Timer,
} from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/ui/card';
import { Checkbox } from '@shared/ui/checkbox';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@shared/ui/empty';
import { Progress } from '@shared/ui/progress';
import { Skeleton } from '@shared/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/ui/table';
import { loadUsage, selectProjectsToKeep as selectProjectsThunk } from '../store/thunks';
import {
  selectLoadingUsage,
  selectUsage,
  selectUsageError,
} from '../store/selectors';

/** Human-readable byte size (metering). 0 → "0 B". */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exp;
  return `${value.toFixed(exp === 0 ? 0 : 1)} ${units[exp]}`;
}

/**
 * Visual treatment for a project's last backup status. `dot` recolours the
 * indicator using semantic state tokens only (monochrome design system);
 * `spin` is reserved for the in-flight `running` state.
 */
type StatusStyle = { icon: typeof Circle; dot: string; spin?: boolean };

const IDLE_STYLE: StatusStyle = { icon: Circle, dot: 'text-muted-foreground' };

const STATUS_STYLE: Record<string, StatusStyle> = {
  success: { icon: CheckCircle2, dot: 'text-success' },
  failed: { icon: TriangleAlert, dot: 'text-destructive' },
  running: { icon: Loader2, dot: 'text-muted-foreground', spin: true },
  idle: IDLE_STYLE,
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('billing');
  const style = STATUS_STYLE[status] ?? IDLE_STYLE;
  const Icon = style.icon;
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <Icon className={cn('size-3.5', style.dot, style.spin && 'animate-spin')} />
      {t(`usage.status.${status}`, { defaultValue: status })}
    </Badge>
  );
}

/**
 * Billing → Usage tab. Owns its own data lifecycle (loads on mount, retries on
 * error, reloads after a project-selection submit) and the selection state.
 */
export const UsageTab = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('billing');
  const usage = useAppSelector(selectUsage);
  const loadingUsage = useAppSelector(selectLoadingUsage);
  const usageError = useAppSelector(selectUsageError);
  const [keepIds, setKeepIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void dispatch(loadUsage());
  }, [dispatch]);

  const toggleKeep = (id: string) => {
    setKeepIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submitSelection = async () => {
    // The submit button is `disabled` whenever `keepIds` is empty, so this
    // early-return is a defensive guard that cannot be reached through the UI.
    /* v8 ignore next */
    if (keepIds.length === 0) return;
    // Lock the form (submit + checkboxes) while the downgrade is in flight so the
    // selection can't change and the request can't be double-fired.
    setSubmitting(true);
    await dispatch(selectProjectsThunk({ keepIds }));
    await dispatch(loadUsage());
    setKeepIds([]);
    setSubmitting(false);
  };

  if (loadingUsage) {
    return (
      <div role="status" aria-live="polite" className="flex flex-col gap-4 py-2">
        <span className="sr-only">{t('page.loading')}</span>
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (usageError) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-col items-start gap-3">
          <span>{usageError}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void dispatch(loadUsage())}
          >
            {t('usage.retry')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!usage) {
    return <p className="py-6 text-muted-foreground">{t('page.empty')}</p>;
  }

  const { cap, used } = usage.projects;
  const overCap = cap !== null && used > cap;
  const agentsUsed = usage.agents.used;
  const agentsCap = usage.agents.cap;
  const agentsOverCap = agentsCap !== null && agentsUsed > agentsCap;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">{t('usage.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('usage.lede')}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="gap-0">
          <CardHeader className="gap-1">
            <CardDescription className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
              <FolderGit2 className="size-3.5" />
              {t('usage.stat.projects')}
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              <span className={cn(overCap && 'text-destructive')}>{used}</span>
              <span className="text-base font-normal text-muted-foreground">
                {' / '}
                {cap ?? t('grid.caps.unlimited')}
              </span>
            </CardTitle>
          </CardHeader>
          {cap !== null ? (
            <CardContent className="mt-3">
              <Progress value={used} max={cap} aria-label={t('usage.quotaLabel')} />
            </CardContent>
          ) : null}
        </Card>

        <Card className="gap-0">
          <CardHeader className="gap-1">
            <CardDescription className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
              <Server className="size-3.5" />
              {t('usage.stat.agents')}
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              <span className={cn(agentsOverCap && 'text-destructive')}>{agentsUsed}</span>
              <span className="text-base font-normal text-muted-foreground">
                {' / '}
                {agentsCap ?? t('grid.caps.unlimited')}
              </span>
            </CardTitle>
          </CardHeader>
          {agentsCap !== null ? (
            <CardContent className="mt-3">
              <Progress value={agentsUsed} max={agentsCap} aria-label={t('usage.agentsQuotaLabel')} />
            </CardContent>
          ) : null}
        </Card>

        <Card className="gap-0">
          <CardHeader className="gap-1">
            <CardDescription className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
              <Archive className="size-3.5" />
              {t('usage.stat.retention')}
            </CardDescription>
            <CardTitle className="text-2xl">
              {t('usage.stat.retentionValue', { days: usage.retentionDays })}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="gap-0">
          <CardHeader className="gap-1">
            <CardDescription className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
              <Timer className="size-3.5" />
              {t('usage.stat.frequency')}
            </CardDescription>
            <CardTitle className="text-2xl">
              {t(`grid.frequency.${usage.frequency}`)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {usage.flags.schedules || usage.flags.emailAlerts ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t('usage.features.title')}</h3>
          <div className="flex flex-wrap gap-2">
            {usage.flags.schedules ? (
              <Badge variant="outline" className="gap-1.5">
                <CalendarClock className="size-3.5" />
                {t('grid.flag.schedules')}
              </Badge>
            ) : null}
            {usage.flags.emailAlerts ? (
              <Badge variant="outline" className="gap-1.5">
                <Mail className="size-3.5" />
                {t('grid.flag.emailAlerts')}
              </Badge>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">{t('usage.metering.title')}</h3>
        {usage.metering.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderGit2 />
              </EmptyMedia>
              <EmptyTitle className="text-base">{t('usage.metering.empty')}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <Card className="overflow-hidden py-0">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">{t('usage.metering.colProject')}</TableHead>
                    <TableHead scope="col">{t('usage.metering.colStatus')}</TableHead>
                    <TableHead scope="col" className="text-end">
                      {t('usage.metering.colSnapshots')}
                    </TableHead>
                    <TableHead scope="col" className="text-end">
                      {t('usage.metering.colSize')}
                    </TableHead>
                    <TableHead scope="col">{t('usage.metering.colLastRun')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usage.metering.map((m) => (
                    <TableRow key={m.id}>
                      <TableHead scope="row" className="font-medium">
                        {m.name}
                      </TableHead>
                      <TableCell>
                        <StatusBadge status={m.lastStatus} />
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {m.snapshotCount}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {formatBytes(m.sizeBytes)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {m.lastRunAt
                          ? new Date(m.lastRunAt).toLocaleString()
                          : t('usage.metering.never')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {overCap ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertDescription>{t('usage.overCap')}</AlertDescription>
        </Alert>
      ) : null}

      {usage.selectionRequired ? (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{t('selection.title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('selection.help', { cap: cap ?? '' })}
            </p>
            <ul className="flex flex-col gap-2">
              {[...usage.projects.active, ...usage.projects.paused].map((p) => (
                <li key={p.id}>
                  <label htmlFor={`keep-${p.id}`} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id={`keep-${p.id}`}
                      checked={keepIds.includes(p.id)}
                      onCheckedChange={() => toggleKeep(p.id)}
                      disabled={submitting}
                    />{' '}
                    {p.name}
                  </label>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              className="w-fit"
              onClick={() => void submitSelection()}
              disabled={keepIds.length === 0 || submitting}
              aria-busy={submitting}
            >
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {t('selection.submit')}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};
