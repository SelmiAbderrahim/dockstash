import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { ResticLogPanel } from '@shared/components/ResticLogPanel';
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
      return t('projects.status.running');
    case 'success':
      return t('projects.status.success');
    case 'failed':
      return t('projects.status.failed');
    default:
      return t('projects.status.idle');
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
    <article className="ds-card" aria-labelledby={`project-${project.id}`}>
      <header className="ds-card__header">
        <h2 id={`project-${project.id}`}>{project.name}</h2>
        <span className="ds-badge" data-status={project.lastStatus}>
          {statusLabel(project.lastStatus, t)}
        </span>
      </header>
      <dl className="ds-card__meta">
        <div>
          <dt>{t('meta.path')}</dt>
          <dd>{project.path}</dd>
        </div>
        <div>
          <dt>{t('meta.lastRun')}</dt>
          <dd>{lastRun}</dd>
        </div>
      </dl>
      <div className="ds-card__actions">
        <button
          type="button"
          className="ds-btn ds-btn--primary"
          onClick={() => void dispatch(runBackupNow({ projectId: project.id }))}
          disabled={running}
          aria-label={t('actions.backupNow')}
        >
          {running ? t('actions.running') : t('actions.backupNow')}
        </button>
        <Link className="ds-btn ds-btn--ghost" to={`/projects/${project.id}`}>
          {t('actions.open')}
        </Link>
      </div>
      {jobId && (
        <ResticLogPanel
          jobId={jobId}
          onDone={() => dispatch(clearActiveJob({ projectId: project.id }))}
        />
      )}
    </article>
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
    <section className="ds-screen" aria-labelledby="projects-heading">
      <header className="ds-screen__header">
        <h1 id="projects-heading">{t('heading')}</h1>
        <p className="ds-screen__lede">{t('lede')}</p>
      </header>

      {status === 'loading' && (
        <p role="status" aria-live="polite" className="ds-loading">
          <span className="ds-spinner" aria-hidden="true" /> {t('loading')}
        </p>
      )}

      {status === 'failed' && (
        <p role="alert" className="ds-alert">
          {error ?? t('errors.load')}{' '}
          <button
            type="button"
            className="ds-btn ds-btn--link"
            onClick={() => void dispatch(fetchProjects())}
          >
            {t('actions.retry')}
          </button>
        </p>
      )}

      {status === 'succeeded' && items.length === 0 && (
        <div className="ds-empty">
          <p>{t('empty.title')}</p>
          <p className="ds-empty__hint">{t('empty.hint')}</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="ds-grid" data-testid="projects-grid">
          {items.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </section>
  );
};
