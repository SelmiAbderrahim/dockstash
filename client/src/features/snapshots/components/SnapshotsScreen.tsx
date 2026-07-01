import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { ResticLogPanel } from '@shared/components/ResticLogPanel';
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
    <section className="ds-screen" aria-labelledby="snapshots-heading">
      <header className="ds-screen__header">
        <h1 id="snapshots-heading">{t('heading')}</h1>
        <p className="ds-screen__lede">{t('lede')}</p>
      </header>

      {projects.length > 0 && (
        <label className="ds-field">
          <span>{t('selectProject')}</span>
          <select
            value={projectId}
            onChange={(e) => onSelectProject(e.target.value)}
            aria-label={t('selectProject')}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {status === 'loading' && (
        <p role="status" aria-live="polite" className="ds-loading">
          <span className="ds-spinner" aria-hidden="true" /> {t('loading')}
        </p>
      )}

      {status === 'failed' && (
        <p role="alert" className="ds-alert">
          {error ?? t('errors.load')}
        </p>
      )}

      {status === 'succeeded' && snapshots.length === 0 && (
        <div className="ds-empty">
          <p>{t('empty.title')}</p>
          <p className="ds-empty__hint">{t('empty.hint')}</p>
        </div>
      )}

      {snapshots.length > 0 && (
        <table className="ds-table" aria-label={t('tableLabel')}>
          <thead>
            <tr>
              <th scope="col">{t('columns.date')}</th>
              <th scope="col">{t('columns.size')}</th>
              <th scope="col">
                <span className="sr-only">{t('columns.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((s) => (
              <tr key={s.id}>
                <td>{new Date(s.time).toLocaleString(i18n.language)}</td>
                <td>{formatBytes(s.sizeBytes)}</td>
                <td>
                  <button
                    type="button"
                    className="ds-btn ds-btn--primary"
                    onClick={() => setTarget(s)}
                    disabled={!project}
                  >
                    {t('actions.restore')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
