import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { useTabParam } from '@shared/hooks/useTabParam';
import { Button } from '@shared/ui/button';
import { Badge } from '@shared/ui/badge';
import { Separator } from '@shared/ui/separator';
import { Alert, AlertDescription } from '@shared/ui/alert';
import {
  Card,
  CardContent,
  CardHeader,
} from '@shared/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';
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
    <Card>
      <CardContent>
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            void dispatch(savePlan({ projectId: project.id, plan }));
          }}
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t('plan.files')}</legend>
            {allPaths.length === 0 && (
              <p className="text-muted-foreground text-sm">{t('plan.noFiles')}</p>
            )}
            {allPaths.map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={plan.paths.includes(p)}
                  onChange={() => togglePath(p)}
                  aria-label={p}
                />
                <span className="font-mono text-xs break-all">{p}</span>
              </label>
            ))}
          </fieldset>

          <Separator />

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t('plan.databases')}</legend>
            {plan.databases.length === 0 && (
              <p className="text-muted-foreground text-sm">{t('plan.noDatabases')}</p>
            )}
            {plan.databases.map((db, idx) => (
              <label key={`${db.service}-${idx}`} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={db.enabled}
                  onChange={() => toggleDb(idx)}
                  aria-label={`${db.service} (${db.type})`}
                />
                <span>
                  {db.service} <em className="text-muted-foreground">({db.type})</em>
                </span>
              </label>
            ))}
          </fieldset>

          <Separator />

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t('plan.configs')}</legend>
            {allConfigs.length === 0 && (
              <p className="text-muted-foreground text-sm">{t('plan.noConfigs')}</p>
            )}
            {allConfigs.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={plan.configs.includes(c)}
                  onChange={() => toggleConfig(c)}
                  aria-label={c}
                />
                <span className="font-mono text-xs break-all">{c}</span>
              </label>
            ))}
          </fieldset>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saveStatus === 'loading'}>
              {saveStatus === 'loading' && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              {saveStatus === 'loading' ? t('plan.saving') : t('plan.save')}
            </Button>
            {saveStatus === 'succeeded' && (
              <span role="status" aria-live="polite" className="text-sm text-muted-foreground">
                {t('plan.saved')}
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
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
    // PRESETS always contains the `daily`/`weekly` keys; the `?? ''` is only a
    // TypeScript `noUncheckedIndexedAccess` fallback and is unreachable at runtime.
    /* v8 ignore next */
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
    <Card>
      <CardContent>
        <form className="flex flex-col gap-6" onSubmit={onSubmit} noValidate>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t('schedule.presetLegend')}</legend>
            {(['daily', 'weekly', 'cron'] as const).map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  className="size-4 accent-primary"
                  name="preset"
                  value={p}
                  checked={preset === p}
                  onChange={() => applyPreset(p)}
                />
                <span>{t(`schedule.preset.${p}`)}</span>
              </label>
            ))}
          </fieldset>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">{t('schedule.cronLabel')}</span>
            <input
              type="text"
              className="border-input bg-transparent focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive h-9 w-full rounded-md border px-3 py-1 font-mono text-sm shadow-xs outline-none focus-visible:ring-[3px] read-only:opacity-70"
              {...register('cron')}
              aria-invalid={Boolean(errors.cron)}
              aria-describedby={errors.cron ? 'cron-error' : undefined}
              readOnly={preset !== 'cron'}
              value={cronValue}
              onChange={(e) => setValue('cron', e.target.value)}
            />
            {errors.cron && (
              <Alert variant="destructive" id="cron-error">
                <AlertDescription>
                  {/* zodResolver always sets a message here; the fallback is unreachable. */}
                  {/* v8 ignore next */}
                  {t((errors.cron?.message as string | undefined) ?? 'schedule.errors.cronFormat')}
                </AlertDescription>
              </Alert>
            )}
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" {...register('enabled')} />
            <span>{t('schedule.enabled')}</span>
          </label>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saveStatus === 'loading'}>
              {saveStatus === 'loading' && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              {saveStatus === 'loading' ? t('schedule.saving') : t('schedule.save')}
            </Button>
            {saveStatus === 'succeeded' && (
              <span role="status" aria-live="polite" className="text-sm text-muted-foreground">
                {t('schedule.saved')}
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
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
    <Card aria-labelledby="drill-heading">
      <CardHeader>
        <h2 id="drill-heading" className="text-base leading-none font-semibold">
          {t('drill.heading')}
        </h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!at && <p className="text-muted-foreground text-sm">{t('drill.none')}</p>}
        {at && (
          <p className="flex items-center gap-2 text-sm">
            <Badge
              variant={project.lastDrillStatus === 'pass' ? 'default' : 'destructive'}
              data-status={project.lastDrillStatus === 'pass' ? 'success' : 'failed'}
            >
              {t(`drill.${project.lastDrillStatus ?? 'fail'}`)}
            </Badge>
            <span>{at}</span>
          </p>
        )}
        {project.lastDrillDetail && (
          <p className="text-muted-foreground text-sm">{project.lastDrillDetail}</p>
        )}
      </CardContent>
    </Card>
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
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
        <p
          role="status"
          aria-live="polite"
          className="text-muted-foreground inline-flex items-center gap-2 text-sm"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {t('loading')}
        </p>
      </section>
    );
  }

  return (
    <section
      className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8"
      aria-labelledby="detail-heading"
    >
      <header className="flex flex-col gap-1">
        <h1 id="detail-heading" className="text-2xl font-semibold tracking-tight">
          {project.name}
        </h1>
        <p className="text-muted-foreground font-mono text-xs break-all">{project.path}</p>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <TabsList aria-label={t('tabs.aria')}>
          {TABS.map((k) => (
            <TabsTrigger key={k} value={k}>
              {t(`tabs.${k}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="plan">
          <PlanEditor project={project} />
        </TabsContent>
        <TabsContent value="schedule">
          <ScheduleEditor project={project} />
        </TabsContent>
        <TabsContent value="drill">
          <DrillStatus project={project} />
        </TabsContent>
      </Tabs>
    </section>
  );
};
