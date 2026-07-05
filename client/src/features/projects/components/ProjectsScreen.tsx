import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { ResticLogPanel } from '@shared/components/ResticLogPanel';
import { Button } from '@shared/ui/button';
import { Badge } from '@shared/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
} from '@shared/ui/card';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Skeleton } from '@shared/ui/skeleton';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@shared/ui/empty';
import { fetchProjects, runBackupNow } from '../store/thunks';
import { clearActiveJob } from '../store/slice';
import {
  selectActiveJobForProject,
  selectProjects,
  selectProjectsError,
  selectProjectsStatus,
} from '../store/selectors';
import type { Project } from '../types';

function statusLabel(status: string, t: (k: string) => string): string {
  switch (status) {
    case 'running':
      return t('status.running');
    case 'success':
      return t('status.success');
    case 'failed':
      return t('status.failed');
    default:
      return t('status.idle');
  }
}

function statusVariant(status: string): 'secondary' | 'default' | 'destructive' {
  switch (status) {
    case 'success':
      return 'default';
    case 'failed':
      return 'destructive';
    // 'idle', 'running' and any unknown status use the neutral badge.
    default:
      return 'secondary';
  }
}

interface CardProps {
  project: Project;
}

const ProjectCard = ({ project }: CardProps) => {
  const { t, i18n } = useTranslation('projects');
  const dispatch = useAppDispatch();
  const jobId = useAppSelector(selectActiveJobForProject(project.id));
  const running = Boolean(jobId);

  const lastRun = project.lastRunAt
    ? new Date(project.lastRunAt).toLocaleString(i18n.language)
    : t('never');

  return (
    <Card aria-labelledby={`project-${project.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <h2 id={`project-${project.id}`} className="text-base leading-none font-semibold">
          {project.name}
        </h2>
        <Badge variant={statusVariant(project.lastStatus)} data-status={project.lastStatus}>
          {project.lastStatus === 'running' && (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          )}
          {statusLabel(project.lastStatus, t)}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">{t('meta.path')}</dt>
            <dd className="font-mono text-xs break-all">{project.path}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">{t('meta.lastRun')}</dt>
            <dd>{lastRun}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => void dispatch(runBackupNow({ projectId: project.id }))}
            disabled={running}
            aria-label={t('actions.backupNow')}
          >
            {running && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {running ? t('actions.running') : t('actions.backupNow')}
          </Button>
          <Button asChild variant="outline">
            <Link to={`/projects/${project.id}`}>{t('actions.open')}</Link>
          </Button>
        </div>
        {jobId && (
          <ResticLogPanel
            jobId={jobId}
            onDone={() => {
              dispatch(clearActiveJob({ projectId: project.id }));
              // Pull fresh status so the badge/last-run reflect the finished run
              // (success clears any prior failure) without a page reload.
              void dispatch(fetchProjects());
            }}
          />
        )}
      </CardContent>
    </Card>
  );
};

export const ProjectsScreen = () => {
  const { t } = useTranslation('projects');
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectProjects);
  const status = useAppSelector(selectProjectsStatus);
  const error = useAppSelector(selectProjectsError);

  useEffect(() => {
    void dispatch(fetchProjects());
  }, [dispatch]);

  return (
    <section
      className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8"
      aria-labelledby="projects-heading"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 id="projects-heading" className="text-2xl font-semibold tracking-tight">
            {t('heading')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('lede')}</p>
        </div>
        <Button asChild data-tour="projects-add-button">
          <Link to="/projects/new">
            <PlusIcon className="size-4" aria-hidden="true" /> {t('actions.addProject')}
          </Link>
        </Button>
      </header>

      {status === 'loading' && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col gap-4"
          data-testid="projects-loading"
        >
          <span className="text-muted-foreground inline-flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {t('loading')}
          </span>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {status === 'failed' && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span>{error ?? t('errors.load')}</span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => void dispatch(fetchProjects())}
            >
              {t('actions.retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {status === 'succeeded' && items.length === 0 && (
        <Empty data-testid="projects-empty">
          <EmptyHeader>
            <EmptyTitle>{t('empty.title')}</EmptyTitle>
            <EmptyDescription>{t('empty.hint')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link to="/projects/new">
                <PlusIcon className="size-4" aria-hidden="true" /> {t('actions.addFirst')}
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {items.length > 0 && (
        <div
          className="grid grid-cols-1 gap-4 lg:grid-cols-2"
          data-testid="projects-grid"
        >
          {items.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </section>
  );
};
