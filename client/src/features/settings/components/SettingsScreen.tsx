import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, HardDrive, KeyRound, Loader2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { useTabParam } from '@shared/hooks/useTabParam';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Textarea } from '@shared/ui/textarea';
import { Switch } from '@shared/ui/switch';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Card, CardContent } from '@shared/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';
import {
  fetchRetention,
  fetchStorage,
  savePassword,
  saveRetention,
  saveStorage,
} from '../store/thunks';
import {
  selectPasswordSaveStatus,
  selectRetention,
  selectRetentionSaveStatus,
  selectSettingsError,
  selectStorage,
  selectStorageSaveStatus,
  selectStorageStatus,
} from '../store/selectors';

const TABS = ['storage', 'retention', 'password'] as const;

const TAB_ICONS = {
  storage: HardDrive,
  retention: Clock,
  password: KeyRound,
} as const;

const SavedNotice = ({ children }: { children: React.ReactNode }) => (
  <span role="status" className="text-sm font-medium text-success">
    {children}
  </span>
);

const SaveError = ({ children }: { children: React.ReactNode }) => (
  <span role="alert" className="text-sm font-medium text-destructive">
    {children}
  </span>
);

const StorageTab = () => {
  const { t } = useTranslation('settings');
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectStorageStatus);
  const saveStatus = useAppSelector(selectStorageSaveStatus);
  const storage = useAppSelector(selectStorage);
  const error = useAppSelector(selectSettingsError);

  const [host, setHost] = useState('');
  const [user, setUser] = useState('root');
  const [port, setPort] = useState(22);
  const [privateKey, setPrivateKey] = useState('');

  useEffect(() => {
    if (storage) {
      setHost(storage.host);
      setUser(storage.user || 'root');
      setPort(storage.port || 22);
    }
  }, [storage]);

  if (status === 'loading') {
    return (
      <p
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {t('loading')}
      </p>
    );
  }
  if (status === 'failed') {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error ?? t('errors.load')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void dispatch(saveStorage({ host, user, port, privateKey }));
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="storage-host">{t('storage.host')}</Label>
            <Input
              id="storage-host"
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="storage-user">{t('storage.user')}</Label>
              <Input
                id="storage-user"
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="storage-port">{t('storage.port')}</Label>
              <Input
                id="storage-port"
                type="number"
                value={port}
                min={1}
                max={65535}
                onChange={(e) => setPort(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="storage-key">{t('storage.privateKey')}</Label>
            <Textarea
              id="storage-key"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              rows={6}
              placeholder={t('storage.privateKeyPlaceholder')}
              autoComplete="off"
              className="font-mono text-xs"
            />
            <small className="text-sm text-muted-foreground">{t('storage.privateKeyHint')}</small>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saveStatus === 'loading'}>
              {saveStatus === 'loading' ? t('actions.saving') : t('actions.connect')}
            </Button>
            {saveStatus === 'succeeded' && <SavedNotice>{t('storage.saved')}</SavedNotice>}
            {saveStatus === 'failed' && <SaveError>{error ?? t('errors.save')}</SaveError>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const RetentionTab = () => {
  const { t } = useTranslation('settings');
  const dispatch = useAppDispatch();
  const retention = useAppSelector(selectRetention);
  const saveStatus = useAppSelector(selectRetentionSaveStatus);
  const [keepDaily, setKeepDaily] = useState(7);
  const [keepWeekly, setKeepWeekly] = useState(4);
  const [keepMonthly, setKeepMonthly] = useState(6);

  useEffect(() => {
    if (retention) {
      setKeepDaily(retention.keepDaily);
      setKeepWeekly(retention.keepWeekly);
      setKeepMonthly(retention.keepMonthly);
    }
  }, [retention]);

  return (
    <Card>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void dispatch(saveRetention({ keepDaily, keepWeekly, keepMonthly }));
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="retention-daily">{t('retention.daily')}</Label>
              <Input
                id="retention-daily"
                type="number"
                min={0}
                value={keepDaily}
                onChange={(e) => setKeepDaily(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="retention-weekly">{t('retention.weekly')}</Label>
              <Input
                id="retention-weekly"
                type="number"
                min={0}
                value={keepWeekly}
                onChange={(e) => setKeepWeekly(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="retention-monthly">{t('retention.monthly')}</Label>
              <Input
                id="retention-monthly"
                type="number"
                min={0}
                value={keepMonthly}
                onChange={(e) => setKeepMonthly(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saveStatus === 'loading'}>
              {saveStatus === 'loading' ? t('actions.saving') : t('actions.save')}
            </Button>
            {saveStatus === 'succeeded' && <SavedNotice>{t('retention.saved')}</SavedNotice>}
            {saveStatus === 'failed' && <SaveError>{t('errors.save')}</SaveError>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const PasswordTab = () => {
  const { t } = useTranslation('settings');
  const dispatch = useAppDispatch();
  const saveStatus = useAppSelector(selectPasswordSaveStatus);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ack, setAck] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= 12 && !mismatch && ack;

  return (
    <Card>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            void dispatch(savePassword(password));
            setPassword('');
            setConfirm('');
          }}
        >
          <Alert variant="destructive">
            <AlertDescription>{t('password.warning')}</AlertDescription>
          </Alert>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password-new">{t('password.new')}</Label>
            <Input
              id="password-new"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={12}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password-confirm">{t('password.confirm')}</Label>
            <Input
              id="password-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={mismatch}
              autoComplete="new-password"
              required
            />
            {mismatch && (
              <span role="alert" className="text-sm text-destructive">
                {t('password.mismatch')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Switch id="password-escrow" checked={ack} onCheckedChange={setAck} />
            <Label htmlFor="password-escrow" className="font-normal">
              {t('password.escrow')}
            </Label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!canSubmit || saveStatus === 'loading'}>
              {saveStatus === 'loading' ? t('actions.saving') : t('actions.save')}
            </Button>
            {saveStatus === 'succeeded' && <SavedNotice>{t('password.saved')}</SavedNotice>}
            {saveStatus === 'failed' && <SaveError>{t('errors.save')}</SaveError>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export const SettingsScreen = () => {
  const { t } = useTranslation('settings');
  const dispatch = useAppDispatch();
  const [tab, setTab] = useTabParam('storage', TABS);

  useEffect(() => {
    void dispatch(fetchStorage());
    void dispatch(fetchRetention());
  }, [dispatch]);

  return (
    <section
      className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8"
      aria-labelledby="settings-heading"
    >
      <header>
        <h1 id="settings-heading" className="text-2xl font-semibold tracking-tight">
          {t('heading')}
        </h1>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label={t('tabs.aria')} className="w-full">
          {TABS.map((k) => {
            const Icon = TAB_ICONS[k];
            return (
              <TabsTrigger key={k} value={k}>
                <Icon className="size-4" aria-hidden="true" />
                {t(`tabs.${k}`)}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="storage" className="mt-4">
          <StorageTab />
        </TabsContent>
        <TabsContent value="retention" className="mt-4">
          <RetentionTab />
        </TabsContent>
        <TabsContent value="password" className="mt-4">
          <PasswordTab />
        </TabsContent>
      </Tabs>
    </section>
  );
};
