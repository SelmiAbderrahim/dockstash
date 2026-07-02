import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Button } from '@shared/ui/button';
import { Card, CardContent } from '@shared/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';
import { useTabParam } from '../hooks/useTabParam';
import { PricingGrid } from './PricingGrid';
import { UsageTab } from './UsageTab';
import { loadOverview, openPortal } from '../store/thunks';
import {
  selectBillingError,
  selectBillingMessage,
  selectBillingOverview,
  selectLoadingOverview,
} from '../store/selectors';

const TABS = ['overview', 'usage', 'plans'] as const;
type Tab = (typeof TABS)[number];

export const BillingPage = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('billing');
  const [tab, setTab] = useTabParam<Tab>('overview', TABS);
  const overview = useAppSelector(selectBillingOverview);
  const loadingOverview = useAppSelector(selectLoadingOverview);
  const error = useAppSelector(selectBillingError);
  const message = useAppSelector(selectBillingMessage);

  useEffect(() => {
    void dispatch(loadOverview());
  }, [dispatch]);

  const onOpenPortal = () => {
    void dispatch(openPortal()).then((result) => {
      if (openPortal.fulfilled.match(result)) {
        window.location.href = result.payload.url;
      }
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
          <UsageTab />
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
