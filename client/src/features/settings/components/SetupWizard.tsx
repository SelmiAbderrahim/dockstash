import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, Loader2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Textarea } from '@shared/ui/textarea';
import { Switch } from '@shared/ui/switch';
import { Badge } from '@shared/ui/badge';
import { Alert, AlertDescription } from '@shared/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@shared/ui/card';
import {
  fetchStorage,
  savePassword,
  saveStorage,
  testStorage,
} from '../store/thunks';
import {
  selectPasswordSaveStatus,
  selectSetupNeeded,
  selectSettingsError,
  selectStorageSaveStatus,
  selectStorageStatus,
  selectStorageTestStatus,
} from '../store/selectors';

function genPassword(): string {
  // 24-char base64 password from cryptographically strong randomness.
  const bytes = new Uint8Array(18);
  (globalThis.crypto ?? (globalThis as unknown as { msCrypto?: Crypto }).msCrypto)
    ?.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[=+/]/g, '').slice(0, 24);
}

type Step = 'storage' | 'password' | 'confirm' | 'done';

const STEP_ORDER: readonly Step[] = ['storage', 'password', 'confirm'];

/**
 * One-time setup wizard. Renders only when no storage is configured. The
 * encryption password is generated (or user-entered) and shown ONCE in
 * step 2; the "Done" button in the confirm step is disabled until the user
 * ticks the escrow acknowledgement box. Once the wizard closes, the
 * password is no longer displayed.
 */
export const SetupWizard = () => {
  const { t } = useTranslation('wizard');
  const dispatch = useAppDispatch();
  const nav = useNavigate();
  const storageStatus = useAppSelector(selectStorageStatus);
  const setupNeeded = useAppSelector(selectSetupNeeded);
  const storageSaveStatus = useAppSelector(selectStorageSaveStatus);
  const testStatus = useAppSelector(selectStorageTestStatus);
  const passwordSaveStatus = useAppSelector(selectPasswordSaveStatus);
  const error = useAppSelector(selectSettingsError);

  const [step, setStep] = useState<Step>('storage');
  const [host, setHost] = useState('');
  const [user, setUser] = useState('root');
  const [port, setPort] = useState(22);
  const [privateKey, setPrivateKey] = useState('');
  const [password, setPassword] = useState<string>('');
  const [ack, setAck] = useState(false);
  const [passwordRevealed, setPasswordRevealed] = useState(false);

  useEffect(() => {
    if (storageStatus === 'idle') void dispatch(fetchStorage());
  }, [dispatch, storageStatus]);

  if (storageStatus !== 'succeeded') {
    return (
      <p
        role="status"
        aria-live="polite"
        className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {t('loading')}
      </p>
    );
  }

  if (!setupNeeded) {
    // Configured — no wizard needed. Never render the password again.
    return null;
  }

  const goPassword = async () => {
    const result = await dispatch(saveStorage({ host, user, port, privateKey }));
    if (result.meta.requestStatus !== 'fulfilled') return;
    await dispatch(testStorage());
    setPassword(genPassword());
    setPasswordRevealed(true);
    setStep('password');
  };

  const goConfirm = async () => {
    const result = await dispatch(savePassword(password));
    if (result.meta.requestStatus !== 'fulfilled') return;
    setStep('confirm');
    // Wipe the visible password after leaving step 2 confirm view.
    setPasswordRevealed(false);
  };

  const finish = () => {
    setPassword('');
    setStep('done');
    nav('/projects');
  };

  const currentIndex = STEP_ORDER.indexOf(step);

  return (
    <section className="mx-auto w-full max-w-xl px-4 py-8" aria-labelledby="wizard-heading">
      <Card>
        <CardHeader>
          <h1
            id="wizard-heading"
            className="text-2xl leading-none font-semibold tracking-tight"
          >
            {t('heading')}
          </h1>
          <CardDescription>{t('lede')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ol className="flex flex-col gap-2 sm:flex-row sm:gap-4" aria-label={t('stepsAria')}>
            {STEP_ORDER.map((s, index) => {
              const done = index < currentIndex;
              const current = index === currentIndex;
              return (
                <li
                  key={s}
                  aria-current={current ? 'step' : undefined}
                  className="flex items-center gap-2"
                >
                  <Badge
                    variant={current ? 'default' : done ? 'secondary' : 'outline'}
                    className="size-6 rounded-full p-0"
                  >
                    {done ? <Check className="size-3" aria-hidden="true" /> : index + 1}
                  </Badge>
                  <span
                    className={
                      current
                        ? 'text-sm font-medium text-foreground'
                        : 'text-sm text-muted-foreground'
                    }
                  >
                    {t(`step.${s}`)}
                  </span>
                </li>
              );
            })}
          </ol>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === 'storage' && (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void goPassword();
              }}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="wizard-host">{t('storage.host')}</Label>
                <Input
                  id="wizard-host"
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="wizard-user">{t('storage.user')}</Label>
                  <Input
                    id="wizard-user"
                    type="text"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="wizard-port">{t('storage.port')}</Label>
                  <Input
                    id="wizard-port"
                    type="number"
                    min={1}
                    max={65535}
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="wizard-key">{t('storage.privateKey')}</Label>
                <Textarea
                  id="wizard-key"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  rows={6}
                  required
                  autoComplete="off"
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <Button
                  type="submit"
                  disabled={storageSaveStatus === 'loading' || testStatus === 'loading'}
                >
                  {storageSaveStatus === 'loading' ? t('actions.connecting') : t('actions.connect')}
                </Button>
              </div>
            </form>
          )}

          {step === 'password' && (
            <div className="flex flex-col gap-4">
              <Alert variant="destructive">
                <AlertDescription>{t('password.warning')}</AlertDescription>
              </Alert>
              {/* v8 ignore start -- the password step is only ever entered with the
                  password already revealed, so the `hidden` fallback never renders */}
              {passwordRevealed ? (
                <div
                  className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 p-3"
                  data-testid="wizard-password"
                >
                  <code className="font-mono text-sm break-all">{password}</code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void navigator.clipboard?.writeText(password)}
                  >
                    <Copy className="size-4" aria-hidden="true" />
                    {t('actions.copy')}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('password.hidden')}</p>
              )}
              {/* v8 ignore stop */}
              <div>
                <Button
                  type="button"
                  onClick={() => void goConfirm()}
                  disabled={passwordSaveStatus === 'loading' || password.length === 0}
                >
                  {passwordSaveStatus === 'loading'
                    ? t('actions.saving')
                    : t('actions.continueToConfirm')}
                </Button>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">{t('confirm.body')}</p>
              <div className="flex items-center gap-3">
                <Switch
                  id="wizard-escrow"
                  checked={ack}
                  onCheckedChange={setAck}
                  data-testid="wizard-escrow"
                />
                <Label htmlFor="wizard-escrow" className="font-normal">
                  {t('confirm.escrow')}
                </Label>
              </div>
              <div>
                <Button type="button" disabled={!ack} onClick={finish} data-testid="wizard-done">
                  {t('actions.done')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
};
