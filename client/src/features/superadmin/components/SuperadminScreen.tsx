import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { useTabParam } from '@shared/hooks/useTabParam';
import { PageMeta } from '@shared/seo';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';
import { clearSuperadminMessages } from '../store/slice';
import { selectSuperadminMessage } from '../store/selectors';
import { OverviewTab } from './OverviewTab';
import { UsersTab } from './UsersTab';
import { BillingTab } from './BillingTab';
import { AuditTab } from './AuditTab';
import { SystemTab } from './SystemTab';

const TABS = ['overview', 'users', 'billing', 'audit', 'system'] as const;

export const SuperadminScreen = () => {
  const dispatch = useAppDispatch();
  const message = useAppSelector(selectSuperadminMessage);
  const { t } = useTranslation('superadmin');
  const [tab, setTab] = useTabParam('overview', TABS);

  useEffect(() => {
    return () => {
      dispatch(clearSuperadminMessages());
    };
  }, [dispatch]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <PageMeta title="Superadmin" description="Dockstash superadmin console." />
      <h1 className="text-3xl font-semibold tracking-tighter">{t('title')}</h1>

      {message ? (
        <Alert role="status">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {TABS.map((name) => (
            <TabsTrigger key={name} value={name}>
              {t(`tabs.${name}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="billing">
          <BillingTab />
        </TabsContent>
        <TabsContent value="audit">
          <AuditTab />
        </TabsContent>
        <TabsContent value="system">
          <SystemTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};
