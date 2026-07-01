import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
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
      <p role="status" aria-live="polite" className="ds-loading">
        <span className="ds-spinner" aria-hidden="true" /> {t('loading')}
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

  return (
    <section className="ds-wizard" aria-labelledby="wizard-heading">
      <header>
        <h1 id="wizard-heading">{t('heading')}</h1>
        <p className="ds-screen__lede">{t('lede')}</p>
      </header>

      <ol className="ds-wizard__steps" aria-label={t('stepsAria')}>
        <li aria-current={step === 'storage' ? 'step' : undefined}>{t('step.storage')}</li>
        <li aria-current={step === 'password' ? 'step' : undefined}>{t('step.password')}</li>
        <li aria-current={step === 'confirm' ? 'step' : undefined}>{t('step.confirm')}</li>
      </ol>

      {error && (
        <p role="alert" className="ds-alert">
          {error}
        </p>
      )}

      {step === 'storage' && (
        <form
          className="ds-form"
          onSubmit={(e) => {
            e.preventDefault();
            void goPassword();
          }}
        >
          <label className="ds-field">
            <span>{t('storage.host')}</span>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="ds-field">
            <span>{t('storage.user')}</span>
            <input type="text" value={user} onChange={(e) => setUser(e.target.value)} required />
          </label>
          <label className="ds-field">
            <span>{t('storage.port')}</span>
            <input
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
            />
          </label>
          <label className="ds-field">
            <span>{t('storage.privateKey')}</span>
            <textarea
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              rows={6}
              required
              autoComplete="off"
            />
          </label>
          <div className="ds-form__actions">
            <button
              type="submit"
              className="ds-btn ds-btn--primary"
              disabled={storageSaveStatus === 'loading' || testStatus === 'loading'}
            >
              {storageSaveStatus === 'loading' ? t('actions.connecting') : t('actions.connect')}
            </button>
          </div>
        </form>
      )}

      {step === 'password' && (
        <div className="ds-form">
          <p className="ds-alert" role="alert">
            {t('password.warning')}
          </p>
          {passwordRevealed ? (
            <div className="ds-password-reveal" data-testid="wizard-password">
              <code>{password}</code>
              <button
                type="button"
                className="ds-btn ds-btn--ghost"
                onClick={() => void navigator.clipboard?.writeText(password)}
              >
                {t('actions.copy')}
              </button>
            </div>
          ) : (
            <p className="ds-muted">{t('password.hidden')}</p>
          )}
          <div className="ds-form__actions">
            <button
              type="button"
              className="ds-btn ds-btn--primary"
              onClick={() => void goConfirm()}
              disabled={passwordSaveStatus === 'loading' || password.length === 0}
            >
              {passwordSaveStatus === 'loading'
                ? t('actions.saving')
                : t('actions.continueToConfirm')}
            </button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="ds-form">
          <p>{t('confirm.body')}</p>
          <label className="ds-switch">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              data-testid="wizard-escrow"
            />
            <span>{t('confirm.escrow')}</span>
          </label>
          <div className="ds-form__actions">
            <button
              type="button"
              className="ds-btn ds-btn--primary"
              disabled={!ack}
              onClick={finish}
              data-testid="wizard-done"
            >
              {t('actions.done')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
