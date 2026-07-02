import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Button } from '@shared/ui/button';
import { Card, CardContent } from '@shared/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/ui/table';
import { useTabParam } from '../hooks/useTabParam';
import { PricingGrid } from './PricingGrid';
import {
  loadOverview,
  loadUsage,
  openPortal,
  selectProjectsToKeep as selectProjectsThunk,
} from '../store/thunks';
import {
  selectBillingError,
  selectBillingMessage,
  selectBillingOverview,
  selectLoadingOverview,
  selectLoadingUsage,
  selectUsage,
  selectUsageError,
} from '../store/selectors';

const TABS = ['overview', 'usage', 'plans'] as const;
type Tab = (typeof TABS)[number];

/** Human-readable byte size (metering). 0 → "0 B". */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exp;
  return `${value.toFixed(exp === 0 ? 0 : 1)} ${units[exp]}`;
}

export const BillingPage = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('billing');
  const [tab, setTab] = useTabParam<Tab>('overview', TABS);
  const overview = useAppSelector(selectBillingOverview);
  const usage = useAppSelector(selectUsage);
  const loadingOverview = useAppSelector(selectLoadingOverview);
  const loadingUsage = useAppSelector(selectLoadingUsage);
  const error = useAppSelector(selectBillingError);
  const usageError = useAppSelector(selectUsageError);
  const message = useAppSelector(selectBillingMessage);
  const [keepIds, setKeepIds] = useState<string[]>([]);

  useEffect(() => {
    void dispatch(loadOverview());
    void dispatch(loadUsage());
  }, [dispatch]);

  const toggleKeep = (id: string) => {
    setKeepIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const onOpenPortal = () => {
    void dispatch(openPortal()).then((result) => {
      if (openPortal.fulfilled.match(result)) {
        window.location.href = result.payload.url;
      }
    });
  };

  const submitSelection = () => {
    // The submit button is `disabled` whenever `keepIds` is empty, so this
    // early-return is a defensive guard that cannot be reached through the UI.
    /* v8 ignore next */
    if (keepIds.length === 0) return;
    void dispatch(selectProjectsThunk({ keepIds })).then(() => {
      void dispatch(loadUsage());
      setKeepIds([]);
    });
  };

  return (
    <main
      className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8"
      aria-labelledby="billing-page-title"
    >
      <h1 id="billing-page-title" className="text-2xl font-bold tracking-tight">
        {t('page.title')}
      </h1>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList aria-label={t('page.tabsLabel')}>
          {TABS.map((name) => (
            <TabsTrigger key={name} value={name}>
              {t(`page.tab.${name}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          {loadingOverview ? (
            <p role="status" aria-live="polite" className="py-6 text-muted-foreground">
              {t('page.loading')}
            </p>
          ) : overview ? (
            <Card>
              <CardContent>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <dt className="text-sm text-muted-foreground">{t('overview.plan')}</dt>
                    <dd className="font-medium">{t(`plan.${overview.slug}`)}</dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="text-sm text-muted-foreground">{t('overview.status')}</dt>
                    <dd className="font-medium">{t(`status.${overview.status}`)}</dd>
                  </div>
                  {overview.currentPeriodEnd ? (
                    <div className="flex flex-col gap-1">
                      <dt className="text-sm text-muted-foreground">{t('overview.renewsOn')}</dt>
                      <dd className="font-medium">
                        {new Date(overview.currentPeriodEnd).toLocaleDateString()}
                      </dd>
                    </div>
                  ) : null}
                  {overview.graceEndsAt ? (
                    <div className="flex flex-col gap-1">
                      <dt className="text-sm text-muted-foreground">
                        {t('overview.gracePeriod')}
                      </dt>
                      <dd className="font-medium">
                        {new Date(overview.graceEndsAt).toLocaleDateString()}
                      </dd>
                    </div>
                  ) : null}
                  {overview.cancelAtPeriodEnd ? (
                    <div className="text-sm text-muted-foreground sm:col-span-2">
                      {t('overview.cancelAtPeriodEnd')}
                    </div>
                  ) : null}
                </dl>
              </CardContent>
            </Card>
          ) : (
            <p className="py-6 text-muted-foreground">{t('page.empty')}</p>
          )}
        </TabsContent>

        <TabsContent value="usage">
          {loadingUsage ? (
            <p role="status" aria-live="polite" className="py-6 text-muted-foreground">
              {t('page.loading')}
            </p>
          ) : usage ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-1 text-sm">
                <p>
                  {t('usage.projects', {
                    used: usage.projects.used,
                    cap: usage.projects.cap ?? t('grid.caps.unlimited'),
                  })}
                </p>
                <p>{t('usage.retention', { days: usage.retentionDays })}</p>
                <p>{t(`grid.frequency.${usage.frequency}`)}</p>
              </div>

              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold">{t('usage.metering.title')}</h2>
                {usage.metering.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('usage.metering.empty')}</p>
                ) : (
                  <Card>
                    <CardContent className="px-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead scope="col">{t('usage.metering.colProject')}</TableHead>
                            <TableHead scope="col">{t('usage.metering.colSnapshots')}</TableHead>
                            <TableHead scope="col">{t('usage.metering.colSize')}</TableHead>
                            <TableHead scope="col">{t('usage.metering.colLastRun')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {usage.metering.map((m) => (
                            <TableRow key={m.id}>
                              <TableHead scope="row">{m.name}</TableHead>
                              <TableCell>{m.snapshotCount}</TableCell>
                              <TableCell>{formatBytes(m.sizeBytes)}</TableCell>
                              <TableCell>
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

              {usage.projects.cap !== null && usage.projects.used > usage.projects.cap ? (
                <Alert variant="destructive">
                  <AlertDescription>{t('usage.overCap')}</AlertDescription>
                </Alert>
              ) : null}

              {usage.selectionRequired ? (
                <Card>
                  <CardContent className="flex flex-col gap-3">
                    <h2 className="text-lg font-semibold">{t('selection.title')}</h2>
                    <p className="text-sm text-muted-foreground">
                      {t('selection.help', { cap: usage.projects.cap ?? '' })}
                    </p>
                    <ul className="flex flex-col gap-2">
                      {[...usage.projects.active, ...usage.projects.paused].map((p) => (
                        <li key={p.id}>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="size-4 accent-primary"
                              checked={keepIds.includes(p.id)}
                              onChange={() => toggleKeep(p.id)}
                            />{' '}
                            {p.name}
                          </label>
                        </li>
                      ))}
                    </ul>
                    <Button
                      type="button"
                      className="w-fit"
                      onClick={submitSelection}
                      disabled={keepIds.length === 0}
                    >
                      {t('selection.submit')}
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : usageError ? (
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
          ) : (
            <p className="py-6 text-muted-foreground">{t('page.empty')}</p>
          )}
        </TabsContent>

        <TabsContent value="plans">
          <div className="flex flex-col gap-6 pt-2">
            <PricingGrid />
            {overview && overview.status !== 'none' ? (
              <Button
                type="button"
                variant="outline"
                className="w-fit self-center"
                onClick={onOpenPortal}
              >
                {t('plans.portal')}
              </Button>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
};
