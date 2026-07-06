import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { useTabParam } from '@shared/hooks/useTabParam';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';
import { cn } from '@shared/lib/utils';
import { fetchAlerts, fetchHealthOverview, markAlertsRead } from '../store/thunks';
import {
  selectAlerts,
  selectAlertsStatus,
  selectHealthError,
  selectHealthOverview,
  selectHealthStatus,
  selectMarkStatus,
  selectUnreadAlertCount,
} from '../store/selectors';
import type { AlertItem, HealthStatus, ProjectHealthEntry } from '../types';

const TABS = ['overview', 'alerts'] as const;

const StatusChip = ({ status }: { status: HealthStatus }) => {
  const { t } = useTranslation('health');
  if (status === 'critical') {
    return <Badge variant="destructive">{t('status.critical')}</Badge>;
  }
  return (
    <Badge variant="outline" data-status={status}>
      <span
        className={cn(
          'size-1.5 rounded-full',
          status === 'healthy' ? 'bg-success' : 'bg-warning',
        )}
        aria-hidden="true"
      />
      {t(`status.${status}`)}
    </Badge>
  );
};

const SeverityChip = ({ severity }: { severity: AlertItem['severity'] }) => {
  const { t } = useTranslation('health');
  if (severity === 'critical') {
    return (
      <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
        {t('alerts.severity.critical')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-foreground">
      <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
      {t('alerts.severity.warning')}
    </span>
  );
};

const ProjectHealthCard = ({ entry }: { entry: ProjectHealthEntry }) => {
  const { t, i18n } = useTranslation('health');
  return (
    <Card data-testid={`health-project-${entry.projectId}`}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {entry.name}
          <StatusChip status={entry.status} />
          {entry.paused && <Badge variant="secondary">{t('project.paused')}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {entry.reasons.length > 0 && (
          <ul className="text-muted-foreground list-disc ps-5">
            {entry.reasons.map((reason) => (
              <li key={reason}>{t(`reasons.${reason}`)}</li>
            ))}
          </ul>
        )}
        <p className="text-muted-foreground">
          {t('project.lastSuccess')}{' '}
          <span className="text-foreground">
            {entry.lastSuccessAt
              ? new Date(entry.lastSuccessAt).toLocaleString(i18n.language)
              : t('project.never')}
          </span>
        </p>
        {entry.agentStatus !== null && (
          <p className="text-muted-foreground">
            {t('project.agent')}{' '}
            <span className="text-foreground">
              {entry.agentStatus === 'online'
                ? t('project.agentOnline')
                : t('project.agentOffline')}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const AlertRow = ({ alert }: { alert: AlertItem }) => {
  const { t, i18n } = useTranslation('health');
  return (
    <li
      data-testid={`health-alert-${alert.id}`}
      className={cn('flex flex-col gap-1 rounded-lg border p-4', !alert.read && 'font-medium')}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span>{alert.projectName}</span>
        <Badge variant="outline">{t(`alerts.kind.${alert.kind}`)}</Badge>
        <SeverityChip severity={alert.severity} />
        {!alert.read && <Badge variant="secondary">{t('alerts.unread')}</Badge>}
      </div>
      <p className="text-muted-foreground text-sm">{alert.error}</p>
      <p className="text-muted-foreground text-xs">
        {new Date(alert.createdAt).toLocaleString(i18n.language)}
      </p>
    </li>
  );
};

export const HealthScreen = () => {
  const { t } = useTranslation('health');
  const dispatch = useAppDispatch();
  const overview = useAppSelector(selectHealthOverview);
  const status = useAppSelector(selectHealthStatus);
  const alerts = useAppSelector(selectAlerts);
  const alertsStatus = useAppSelector(selectAlertsStatus);
  const markStatus = useAppSelector(selectMarkStatus);
  const error = useAppSelector(selectHealthError);
  const unreadCount = useAppSelector(selectUnreadAlertCount);
  const [tab, setTab] = useTabParam('overview', TABS);
  const marking = markStatus === 'loading';

  useEffect(() => {
    void dispatch(fetchHealthOverview());
    void dispatch(fetchAlerts());
  }, [dispatch]);

  return (
    <section
      className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8"
      aria-labelledby="health-heading"
    >
      <header className="flex flex-col gap-1 text-start">
        <h1 id="health-heading" className="text-2xl font-semibold tracking-tight">
          {t('title')}
        </h1>
        <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <TabsList aria-label={t('tabs.aria')}>
          <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
          <TabsTrigger value="alerts">
            {t('tabs.alerts')}
            {unreadCount > 0 && (
              <span className="bg-primary/10 text-primary rounded-full px-2 text-xs font-medium">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-4">
          {status === 'loading' && (
            <p
              role="status"
              aria-live="polite"
              className="text-muted-foreground inline-flex items-center gap-2 text-sm"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {t('loading')}
            </p>
          )}
          {status === 'failed' && (
            <Alert variant="destructive">
              <AlertDescription>{error ?? t('error')}</AlertDescription>
            </Alert>
          )}
          {overview !== null && (
            <>
              <div
                data-testid="health-banner"
                className="flex flex-wrap items-center gap-3 rounded-lg border p-4"
              >
                <StatusChip status={overview.status} />
                <p className="text-muted-foreground text-sm">
                  {t(`banner.${overview.status}`)}
                </p>
              </div>
              {overview.projects.map((entry) => (
                <ProjectHealthCard key={entry.projectId} entry={entry} />
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="flex flex-col gap-4">
          {alertsStatus === 'loading' && (
            <p
              role="status"
              aria-live="polite"
              className="text-muted-foreground inline-flex items-center gap-2 text-sm"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {t('loading')}
            </p>
          )}
          {alertsStatus === 'failed' && (
            <Alert variant="destructive">
              <AlertDescription>{error ?? t('error')}</AlertDescription>
            </Alert>
          )}
          {alertsStatus === 'succeeded' && alerts.length === 0 && (
            <p data-testid="alerts-empty" className="text-muted-foreground text-sm">
              {t('alerts.empty')}
            </p>
          )}
          {alerts.length > 0 && (
            <>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  onClick={() => void dispatch(markAlertsRead({}))}
                  disabled={marking}
                >
                  {marking && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  {marking ? t('alerts.marking') : t('alerts.markAllRead')}
                </Button>
                {markStatus === 'succeeded' && (
                  <span
                    role="status"
                    aria-live="polite"
                    className="text-muted-foreground text-sm"
                  >
                    {t('alerts.marked')}
                  </span>
                )}
              </div>
              <ul className="flex list-none flex-col gap-3">
                {alerts.map((alert) => (
                  <AlertRow key={alert.id} alert={alert} />
                ))}
              </ul>
            </>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
};
