import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { useTabParam } from '@shared/hooks/useTabParam';
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
      <p role="status" aria-live="polite" className="ds-loading">
        <span className="ds-spinner" aria-hidden="true" /> {t('loading')}
      </p>
    );
  }
  if (status === 'failed') {
    return (
      <p role="alert" className="ds-alert">
        {error ?? t('errors.load')}
      </p>
    );
  }

  return (
    <form
      className="ds-form"
      onSubmit={(e) => {
        e.preventDefault();
        void dispatch(saveStorage({ host, user, port, privateKey }));
      }}
    >
      <label className="ds-field">
        <span>{t('storage.host')}</span>
        <input
          type="text"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          required
          autoComplete="off"
        />
      </label>
      <label className="ds-field">
        <span>{t('storage.user')}</span>
        <input
          type="text"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          required
          autoComplete="off"
        />
      </label>
      <label className="ds-field">
        <span>{t('storage.port')}</span>
        <input
          type="number"
          value={port}
          min={1}
          max={65535}
          onChange={(e) => setPort(Number(e.target.value))}
        />
      </label>
      <label className="ds-field">
        <span>{t('storage.privateKey')}</span>
        <textarea
          value={privateKey}
          onChange={(e) => setPrivateKey(e.target.value)}
          rows={6}
          placeholder={t('storage.privateKeyPlaceholder')}
          autoComplete="off"
        />
        <small className="ds-muted">{t('storage.privateKeyHint')}</small>
      </label>
      <div className="ds-form__actions">
        <button
          type="submit"
          className="ds-btn ds-btn--primary"
          disabled={saveStatus === 'loading'}
        >
          {saveStatus === 'loading' ? t('actions.saving') : t('actions.connect')}
        </button>
        {saveStatus === 'succeeded' && (
          <span role="status" className="ds-success">
            {t('storage.saved')}
          </span>
        )}
      </div>
    </form>
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
    <form
      className="ds-form"
      onSubmit={(e) => {
        e.preventDefault();
        void dispatch(saveRetention({ keepDaily, keepWeekly, keepMonthly }));
      }}
    >
      <label className="ds-field">
        <span>{t('retention.daily')}</span>
        <input
          type="number"
          min={0}
          value={keepDaily}
          onChange={(e) => setKeepDaily(Number(e.target.value))}
        />
      </label>
      <label className="ds-field">
        <span>{t('retention.weekly')}</span>
        <input
          type="number"
          min={0}
          value={keepWeekly}
          onChange={(e) => setKeepWeekly(Number(e.target.value))}
        />
      </label>
      <label className="ds-field">
        <span>{t('retention.monthly')}</span>
        <input
          type="number"
          min={0}
          value={keepMonthly}
          onChange={(e) => setKeepMonthly(Number(e.target.value))}
        />
      </label>
      <div className="ds-form__actions">
        <button
          type="submit"
          className="ds-btn ds-btn--primary"
          disabled={saveStatus === 'loading'}
        >
          {saveStatus === 'loading' ? t('actions.saving') : t('actions.save')}
        </button>
        {saveStatus === 'succeeded' && (
          <span role="status" className="ds-success">
            {t('retention.saved')}
          </span>
        )}
      </div>
    </form>
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
    <form
      className="ds-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        void dispatch(savePassword(password));
        setPassword('');
        setConfirm('');
      }}
    >
      <p className="ds-alert" role="alert">
        {t('password.warning')}
      </p>
      <label className="ds-field">
        <span>{t('password.new')}</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={12}
          autoComplete="new-password"
          required
        />
      </label>
      <label className="ds-field">
        <span>{t('password.confirm')}</span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={mismatch}
          autoComplete="new-password"
          required
        />
        {mismatch && (
          <span role="alert" className="ds-field__error">
            {t('password.mismatch')}
          </span>
        )}
      </label>
      <label className="ds-switch">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        <span>{t('password.escrow')}</span>
      </label>
      <div className="ds-form__actions">
        <button
          type="submit"
          className="ds-btn ds-btn--primary"
          disabled={!canSubmit || saveStatus === 'loading'}
        >
          {saveStatus === 'loading' ? t('actions.saving') : t('actions.save')}
        </button>
        {saveStatus === 'succeeded' && (
          <span role="status" className="ds-success">
            {t('password.saved')}
          </span>
        )}
      </div>
    </form>
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
    <section className="ds-screen" aria-labelledby="settings-heading">
      <header className="ds-screen__header">
        <h1 id="settings-heading">{t('heading')}</h1>
      </header>

      <nav className="ds-tabs" role="tablist" aria-label={t('tabs.aria')}>
        {TABS.map((k) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            className={`ds-tab ${tab === k ? 'ds-tab--active' : ''}`}
            onClick={() => setTab(k)}
          >
            {t(`tabs.${k}`)}
          </button>
        ))}
      </nav>

      <div className="ds-tabs__panel" role="tabpanel">
        {tab === 'storage' && <StorageTab />}
        {tab === 'retention' && <RetentionTab />}
        {tab === 'password' && <PasswordTab />}
      </div>
    </section>
  );
};
