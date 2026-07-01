import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { ResticLogPanel } from '@shared/components/ResticLogPanel';
import { cn } from '@shared/lib/utils';
import { Button } from '@shared/ui/button';
import { Label } from '@shared/ui/label';
import { Alert, AlertDescription } from '@shared/ui/alert';
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@shared/ui/empty';
import { fetchProjects } from '@features/projects/store/thunks';
import { selectProjects } from '@features/projects/store/selectors';
import { fetchSnapshots } from '../store/thunks';
import {
  selectActiveRestoreJobId,
  selectSnapshotsError,
  selectSnapshotsForProject,
  selectSnapshotsStatus,
} from '../store/selectors';
import { setActiveRestoreJob } from '../store/slice';
import { RestoreDialog } from './RestoreDialog';
import type { Snapshot } from '../types';

function formatBytes(n: number): string {
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

export const SnapshotsScreen = () => {
  const { t, i18n } = useTranslation('snapshots');
  const dispatch = useAppDispatch();
  const projects = useAppSelector(selectProjects);
  const status = useAppSelector(selectSnapshotsStatus);
  const error = useAppSelector(selectSnapshotsError);
  const activeJobId = useAppSelector(selectActiveRestoreJobId);

  const [params, setParams] = useSearchParams();
  const projectId = params.get('projectId') ?? projects[0]?.id ?? '';
  const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);
  const snapshots = useAppSelector(selectSnapshotsForProject(projectId));

  const [target, setTarget] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (projects.length === 0) void dispatch(fetchProjects());
  }, [dispatch, projects.length]);

  useEffect(() => {
    if (projectId) void dispatch(fetchSnapshots({ projectId }));
  }, [dispatch, projectId]);

  const onSelectProject = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('projectId', id);
    setParams(next, { replace: true });
  };

  return (
    <section
      className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6"
      aria-labelledby="snapshots-heading"
    >
      <header className="flex flex-col gap-1 text-start">
        <h1 id="snapshots-heading" className="text-2xl font-semibold tracking-tight">
          {t('heading')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('lede')}</p>
      </header>

      {projects.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="snapshots-project">{t('selectProject')}</Label>
          <select
            id="snapshots-project"
            value={projectId}
            onChange={(e) => onSelectProject(e.target.value)}
            aria-label={t('selectProject')}
            className={cn(
              'h-9 w-full max-w-sm rounded-md border border-input bg-transparent px-3 py-1',
              'text-start text-sm shadow-xs transition-[color,box-shadow] outline-none',
              'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
              'dark:bg-input/30',
            )}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {status === 'loading' && (
        <div role="status" aria-live="polite" className="flex flex-col gap-3">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t('loading')}
          </span>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      )}

      {status === 'failed' && (
        <Alert variant="destructive">
          <AlertDescription>{error ?? t('errors.load')}</AlertDescription>
        </Alert>
      )}

      {status === 'succeeded' && snapshots.length === 0 && (
        <Empty data-testid="snapshots-empty">
          <EmptyHeader>
            <EmptyTitle>{t('empty.title')}</EmptyTitle>
            <EmptyDescription>{t('empty.hint')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {snapshots.length > 0 && (
        <div className="rounded-lg border">
          <Table aria-label={t('tableLabel')}>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">{t('columns.date')}</TableHead>
                <TableHead className="text-start">{t('columns.size')}</TableHead>
                <TableHead className="text-end">
                  <span className="sr-only">{t('columns.actions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{new Date(s.time).toLocaleString(i18n.language)}</TableCell>
                  <TableCell>{formatBytes(s.sizeBytes)}</TableCell>
                  <TableCell className="text-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setTarget(s)}
                      disabled={!project}
                    >
                      {t('actions.restore')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {activeJobId && (
        <ResticLogPanel
          jobId={activeJobId}
          title={t('restore.stream')}
          onDone={() => dispatch(setActiveRestoreJob(null))}
        />
      )}

      {target && project && (
        <RestoreDialog
          snapshot={target}
          projectId={project.id}
          projectName={project.name}
          open={Boolean(target)}
          onClose={() => setTarget(null)}
        />
      )}
    </section>
  );
};
