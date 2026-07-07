import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  Clock,
  Copy,
  DatabaseBackup,
  Download,
  HardDrive,
  KeyRound,
  LifeBuoy,
  Loader2,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { useCopyToClipboard } from '@shared/hooks/useCopyToClipboard';
import { useTabParam } from '@shared/hooks/useTabParam';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Textarea } from '@shared/ui/textarea';
import { Switch } from '@shared/ui/switch';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';
import {
  exportConfig,
  fetchRetention,
  fetchSelfBackupRuns,
  fetchStorage,
  generateRecoveryCodes,
  savePassword,
  saveRetention,
  saveStorage,
  testStorage,
  triggerSelfBackup,
} from '../store/thunks';
import {
  selectExportStatus,
  selectPasswordSaveStatus,
  selectRecoveryCodes,
  selectRecoveryCodesStatus,
  selectRetention,
  selectRetentionSaveStatus,
  selectSelfBackupRuns,
  selectSelfBackupRunsStatus,
  selectSelfBackupTriggerStatus,
  selectSettingsError,
  selectStorage,
  selectStorageSaveStatus,
  selectStorageStatus,
  selectStorageTestStatus,
} from '../store/selectors';

const TABS = ['storage', 'retention', 'password', 'recovery'] as const;

const TAB_ICONS = {
  storage: HardDrive,
  retention: Clock,
  password: KeyRound,
  recovery: LifeBuoy,
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
  const testStatus = useAppSelector(selectStorageTestStatus);
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
              data-tour="storage-host"
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
              data-tour="storage-key"
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
            <Button type="submit" data-tour="storage-save" disabled={saveStatus === 'loading'}>
              {saveStatus === 'loading' ? t('actions.saving') : t('actions.connect')}
            </Button>
            <Button
              type="button"
              variant="outline"
              data-tour="storage-test"
              onClick={() => void dispatch(testStorage())}
              disabled={testStatus === 'loading' || !storage?.configured}
            >
              {testStatus === 'loading' ? t('actions.testing') : t('actions.test')}
            </Button>
            {saveStatus === 'succeeded' && <SavedNotice>{t('storage.saved')}</SavedNotice>}
            {saveStatus === 'failed' && <SaveError>{error ?? t('errors.save')}</SaveError>}
            {testStatus === 'succeeded' && <SavedNotice>{t('storage.testOk')}</SavedNotice>}
            {testStatus === 'failed' && <SaveError>{error ?? t('storage.testFailed')}</SaveError>}
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
                data-tour="retention-daily"
                type="number"
                min={0}
                value={keepDaily}
                onChange={(e) => setKeepDaily(Number(e.target.value))}
              />
              <small className="text-sm text-muted-foreground">{t('retention.dailyHint')}</small>
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
              <small className="text-sm text-muted-foreground">{t('retention.weeklyHint')}</small>
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
              <small className="text-sm text-muted-foreground">{t('retention.monthlyHint')}</small>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" data-tour="retention-save" disabled={saveStatus === 'loading'}>
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
  const storage = useAppSelector(selectStorage);
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
          {storage?.passwordSet && (
            <Badge variant="secondary" className="w-fit gap-1.5">
              <KeyRound className="size-4" aria-hidden="true" />
              {t('password.isSet')}
            </Badge>
          )}
          <Alert variant="destructive">
            <AlertDescription>{t('password.warning')}</AlertDescription>
          </Alert>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password-new">{t('password.new')}</Label>
            <Input
              id="password-new"
              data-tour="password-new"
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
              data-tour="password-confirm"
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
            <Switch
              id="password-escrow"
              data-tour="password-escrow"
              checked={ack}
              onCheckedChange={setAck}
            />
            <Label htmlFor="password-escrow" className="font-normal">
              {t('password.escrow')}
            </Label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              data-tour="password-save"
              disabled={!canSubmit || saveStatus === 'loading'}
            >
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

const formatRunTime = (value: string | null): string =>
  value ? new Date(value).toLocaleString() : '—';

const runBadgeVariant = (status: string): 'default' | 'destructive' | 'secondary' => {
  if (status === 'success') return 'default';
  if (status === 'failed') return 'destructive';
  return 'secondary';
};

const SelfBackupRunsList = () => {
  const { t } = useTranslation('settings');
  const runs = useAppSelector(selectSelfBackupRuns);
  const status = useAppSelector(selectSelfBackupRunsStatus);
  const error = useAppSelector(selectSettingsError);

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
  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('recovery.selfBackup.empty')}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {runs.map((run) => (
        <li key={run.id} className="flex flex-col gap-1 rounded-md border p-3">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm">{run.repo}</span>
            <Badge variant={runBadgeVariant(run.status)}>{run.status}</Badge>
          </span>
          <span className="text-sm text-muted-foreground">
            {formatRunTime(run.startedAt)} – {formatRunTime(run.finishedAt)}
          </span>
          {run.error && (
            <span role="alert" className="text-sm text-destructive">
              {run.error}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
};

const RecoveryTab = () => {
  const { t } = useTranslation('settings');
  const dispatch = useAppDispatch();
  const exportStatus = useAppSelector(selectExportStatus);
  const recoveryCodes = useAppSelector(selectRecoveryCodes);
  const codesStatus = useAppSelector(selectRecoveryCodesStatus);
  const triggerStatus = useAppSelector(selectSelfBackupTriggerStatus);
  const error = useAppSelector(selectSettingsError);
  const { copied, copy } = useCopyToClipboard();

  useEffect(() => {
    void dispatch(fetchSelfBackupRuns());
  }, [dispatch]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('recovery.export.title')}</CardTitle>
          <CardDescription>{t('recovery.export.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => void dispatch(exportConfig())}
              disabled={exportStatus === 'loading'}
            >
              <Download className="size-4" aria-hidden="true" />
              {exportStatus === 'loading' ? t('recovery.export.working') : t('recovery.export.action')}
            </Button>
            {exportStatus === 'succeeded' && <SavedNotice>{t('recovery.export.done')}</SavedNotice>}
            {exportStatus === 'failed' && <SaveError>{error ?? t('errors.save')}</SaveError>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('recovery.codes.title')}</CardTitle>
          <CardDescription>{t('recovery.codes.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => void dispatch(generateRecoveryCodes())}
              disabled={codesStatus === 'loading'}
            >
              <KeyRound className="size-4" aria-hidden="true" />
              {codesStatus === 'loading' ? t('recovery.codes.working') : t('recovery.codes.action')}
            </Button>
            {codesStatus === 'failed' && <SaveError>{error ?? t('errors.save')}</SaveError>}
          </div>
          {recoveryCodes && (
            <div className="flex flex-col gap-3">
              <Alert variant="destructive">
                <AlertDescription>{t('recovery.codes.warning')}</AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground">{recoveryCodes.message}</p>
              <ul className="flex flex-col gap-1 rounded-md border bg-muted/50 p-3 font-mono text-sm">
                {recoveryCodes.codes.map((code) => (
                  <li key={code}>{code}</li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void copy(recoveryCodes.codes.join('\n'))}
                >
                  {copied ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : (
                    <Copy className="size-4" aria-hidden="true" />
                  )}
                  {t('recovery.codes.copy')}
                </Button>
                {copied && <SavedNotice>{t('recovery.codes.copied')}</SavedNotice>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('recovery.selfBackup.title')}</CardTitle>
          <CardDescription>{t('recovery.selfBackup.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => {
                void dispatch(triggerSelfBackup()).then(() => dispatch(fetchSelfBackupRuns()));
              }}
              disabled={triggerStatus === 'loading'}
            >
              <DatabaseBackup className="size-4" aria-hidden="true" />
              {triggerStatus === 'loading'
                ? t('recovery.selfBackup.working')
                : t('recovery.selfBackup.action')}
            </Button>
            {triggerStatus === 'succeeded' && (
              <SavedNotice>{t('recovery.selfBackup.triggered')}</SavedNotice>
            )}
            {triggerStatus === 'failed' && <SaveError>{error ?? t('errors.save')}</SaveError>}
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{t('recovery.selfBackup.runs')}</h3>
            <SelfBackupRunsList />
          </div>
        </CardContent>
      </Card>
    </div>
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
        <TabsContent value="recovery" className="mt-4">
          <RecoveryTab />
        </TabsContent>
      </Tabs>
    </section>
  );
};
