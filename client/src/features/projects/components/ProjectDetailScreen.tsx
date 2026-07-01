import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { useTabParam } from '@shared/hooks/useTabParam';
import { fetchProjects, fetchSchedules, savePlan, saveSchedule } from '../store/thunks';
import {
  selectPlanSaveStatus,
  selectProjectById,
  selectScheduleForProject,
  selectScheduleSaveStatus,
} from '../store/selectors';
import { resetSaveStatus } from '../store/slice';
import type { Project, ProjectPlan } from '../types';

const TABS = ['plan', 'schedule', 'drill'] as const;
type Tab = (typeof TABS)[number];

// Loose cron sanity check (5 or 6 whitespace-separated tokens). Server does
// full node-cron validation on submit.
const cronSchema = z.object({
  cron: z
    .string()
    .trim()
    .min(1)
    .refine((v) => v.split(/\s+/).length >= 5 && v.split(/\s+/).length <= 6, {
      message: 'schedule.errors.cronFormat',
    }),
  enabled: z.boolean().default(true),
});

type CronForm = z.infer<typeof cronSchema>;

const PRESETS: Record<string, string> = {
  daily: '0 3 * * *',
  weekly: '0 3 * * 0',
};

interface PlanEditorProps {
  project: Project;
}

const PlanEditor = ({ project }: PlanEditorProps) => {
  const { t } = useTranslation('projectDetail');
  const dispatch = useAppDispatch();
  const saveStatus = useAppSelector(selectPlanSaveStatus);
  const [plan, setPlan] = useState<ProjectPlan>(project.plan);

  useEffect(() => setPlan(project.plan), [project.plan]);

  const togglePath = (path: string) => {
    setPlan((p) => ({
      ...p,
      paths: p.paths.includes(path) ? p.paths.filter((x) => x !== path) : [...p.paths, path],
    }));
  };
  const toggleDb = (idx: number) => {
    setPlan((p) => ({
      ...p,
      databases: p.databases.map((d, i) => (i === idx ? { ...d, enabled: !d.enabled } : d)),
    }));
  };
  const toggleConfig = (cfg: string) => {
    setPlan((p) => ({
      ...p,
      configs: p.configs.includes(cfg) ? p.configs.filter((x) => x !== cfg) : [...p.configs, cfg],
    }));
  };

  const allPaths = useMemo(
    () => Array.from(new Set([...project.plan.paths, ...plan.paths])),
    [project.plan.paths, plan.paths],
  );
  const allConfigs = useMemo(
    () => Array.from(new Set([...project.plan.configs, ...plan.configs])),
    [project.plan.configs, plan.configs],
  );

  return (
    <form
      className="ds-form"
      onSubmit={(e) => {
        e.preventDefault();
        void dispatch(savePlan({ projectId: project.id, plan }));
      }}
    >
      <fieldset>
        <legend>{t('plan.files')}</legend>
        {allPaths.length === 0 && <p className="ds-muted">{t('plan.noFiles')}</p>}
        {allPaths.map((p) => (
          <label key={p} className="ds-switch">
            <input
              type="checkbox"
              checked={plan.paths.includes(p)}
              onChange={() => togglePath(p)}
              aria-label={p}
            />
            <span>{p}</span>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>{t('plan.databases')}</legend>
        {plan.databases.length === 0 && <p className="ds-muted">{t('plan.noDatabases')}</p>}
        {plan.databases.map((db, idx) => (
          <label key={`${db.service}-${idx}`} className="ds-switch">
            <input
              type="checkbox"
              checked={db.enabled}
              onChange={() => toggleDb(idx)}
              aria-label={`${db.service} (${db.type})`}
            />
            <span>
              {db.service} <em>({db.type})</em>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>{t('plan.configs')}</legend>
        {allConfigs.length === 0 && <p className="ds-muted">{t('plan.noConfigs')}</p>}
        {allConfigs.map((c) => (
          <label key={c} className="ds-switch">
            <input
              type="checkbox"
              checked={plan.configs.includes(c)}
              onChange={() => toggleConfig(c)}
              aria-label={c}
            />
            <span>{c}</span>
          </label>
        ))}
      </fieldset>

      <div className="ds-form__actions">
        <button
          type="submit"
          className="ds-btn ds-btn--primary"
          disabled={saveStatus === 'loading'}
        >
          {saveStatus === 'loading' ? t('plan.saving') : t('plan.save')}
        </button>
        {saveStatus === 'succeeded' && (
          <span role="status" aria-live="polite" className="ds-success">
            {t('plan.saved')}
          </span>
        )}
      </div>
    </form>
  );
};

interface ScheduleEditorProps {
  project: Project;
}

const ScheduleEditor = ({ project }: ScheduleEditorProps) => {
  const { t } = useTranslation('projectDetail');
  const dispatch = useAppDispatch();
  const existing = useAppSelector(selectScheduleForProject(project.id));
  const saveStatus = useAppSelector(selectScheduleSaveStatus);
  const [preset, setPreset] = useState<'daily' | 'weekly' | 'cron'>('daily');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CronForm>({
    resolver: zodResolver(cronSchema),
    defaultValues: {
      cron: existing?.cron ?? PRESETS.daily,
      enabled: existing?.enabled ?? true,
    },
  });

  useEffect(() => {
    if (existing) {
      setValue('cron', existing.cron);
      setValue('enabled', existing.enabled);
    }
  }, [existing, setValue]);

  const applyPreset = (next: 'daily' | 'weekly' | 'cron') => {
    setPreset(next);
    if (next !== 'cron') setValue('cron', PRESETS[next] ?? '');
  };

  const cronValue = watch('cron');

  const onSubmit = handleSubmit((values) => {
    void dispatch(
      saveSchedule({
        projectId: project.id,
        scheduleId: existing?.id,
        cron: values.cron.trim(),
        enabled: values.enabled,
      }),
    );
  });

  return (
    <form className="ds-form" onSubmit={onSubmit} noValidate>
      <fieldset>
        <legend>{t('schedule.presetLegend')}</legend>
        {(['daily', 'weekly', 'cron'] as const).map((p) => (
          <label key={p} className="ds-radio">
            <input
              type="radio"
              name="preset"
              value={p}
              checked={preset === p}
              onChange={() => applyPreset(p)}
            />
            <span>{t(`schedule.preset.${p}`)}</span>
          </label>
        ))}
      </fieldset>

      <label className="ds-field">
        <span>{t('schedule.cronLabel')}</span>
        <input
          type="text"
          {...register('cron')}
          aria-invalid={Boolean(errors.cron)}
          aria-describedby={errors.cron ? 'cron-error' : undefined}
          readOnly={preset !== 'cron'}
          value={cronValue}
          onChange={(e) => setValue('cron', e.target.value)}
        />
        {errors.cron && (
          <span id="cron-error" role="alert" className="ds-field__error">
            {t((errors.cron?.message as string | undefined) ?? 'schedule.errors.cronFormat')}
          </span>
        )}
      </label>

      <label className="ds-switch">
        <input type="checkbox" {...register('enabled')} />
        <span>{t('schedule.enabled')}</span>
      </label>

      <div className="ds-form__actions">
        <button
          type="submit"
          className="ds-btn ds-btn--primary"
          disabled={saveStatus === 'loading'}
        >
          {saveStatus === 'loading' ? t('schedule.saving') : t('schedule.save')}
        </button>
        {saveStatus === 'succeeded' && (
          <span role="status" aria-live="polite" className="ds-success">
            {t('schedule.saved')}
          </span>
        )}
      </div>
    </form>
  );
};

interface DrillProps {
  project: Project;
}

const DrillStatus = ({ project }: DrillProps) => {
  const { t, i18n } = useTranslation('projectDetail');
  const at = project.lastDrillAt
    ? new Date(project.lastDrillAt).toLocaleString(i18n.language)
    : null;
  return (
    <section className="ds-drill" aria-labelledby="drill-heading">
      <h2 id="drill-heading">{t('drill.heading')}</h2>
      {!at && <p className="ds-muted">{t('drill.none')}</p>}
      {at && (
        <p>
          <span
            className="ds-badge"
            data-status={project.lastDrillStatus === 'pass' ? 'success' : 'failed'}
          >
            {t(`drill.${project.lastDrillStatus ?? 'fail'}`)}
          </span>{' '}
          <span>{at}</span>
        </p>
      )}
      {project.lastDrillDetail && <p className="ds-muted">{project.lastDrillDetail}</p>}
    </section>
  );
};

export const ProjectDetailScreen = () => {
  const { projectId = '' } = useParams();
  const { t } = useTranslation('projectDetail');
  const dispatch = useAppDispatch();
  const project = useAppSelector(selectProjectById(projectId));
  const [tab, setTab] = useTabParam('plan', TABS);

  useEffect(() => {
    if (!project) void dispatch(fetchProjects());
    void dispatch(fetchSchedules());
    return () => {
      dispatch(resetSaveStatus());
    };
  }, [dispatch, project]);

  if (!project) {
    return (
      <section className="ds-screen">
        <p role="status" aria-live="polite" className="ds-loading">
          <span className="ds-spinner" aria-hidden="true" /> {t('loading')}
        </p>
      </section>
    );
  }

  const activeTab = tab as Tab;

  return (
    <section className="ds-screen" aria-labelledby="detail-heading">
      <header className="ds-screen__header">
        <h1 id="detail-heading">{project.name}</h1>
        <p className="ds-muted">{project.path}</p>
      </header>

      <nav className="ds-tabs" role="tablist" aria-label={t('tabs.aria')}>
        {TABS.map((k) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={activeTab === k}
            className={`ds-tab ${activeTab === k ? 'ds-tab--active' : ''}`}
            onClick={() => setTab(k)}
          >
            {t(`tabs.${k}`)}
          </button>
        ))}
      </nav>

      <div className="ds-tabs__panel" role="tabpanel">
        {activeTab === 'plan' && <PlanEditor project={project} />}
        {activeTab === 'schedule' && <ScheduleEditor project={project} />}
        {activeTab === 'drill' && <DrillStatus project={project} />}
      </div>
    </section>
  );
};
