import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { useTabParam } from '../hooks/useTabParam';
import {
  loadOverview,
  loadUsage,
  selectProjectsToKeep as selectProjectsThunk,
} from '../store/thunks';
import {
  selectBillingError,
  selectBillingMessage,
  selectBillingOverview,
  selectLoadingOverview,
  selectLoadingUsage,
  selectUsage,
} from '../store/selectors';

const TABS = ['overview', 'usage'] as const;
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
  const message = useAppSelector(selectBillingMessage);
  const [keepIds, setKeepIds] = useState<string[]>([]);

  useEffect(() => {
    void dispatch(loadOverview());
    void dispatch(loadUsage());
  }, [dispatch]);

  const toggleKeep = (id: string) => {
    setKeepIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submitSelection = () => {
    if (keepIds.length === 0) return;
    void dispatch(selectProjectsThunk({ keepIds })).then(() => {
      void dispatch(loadUsage());
      setKeepIds([]);
    });
  };

  return (
    <main className="billing-page" aria-labelledby="billing-page-title">
      <h1 id="billing-page-title">{t('page.title')}</h1>

      <nav role="tablist" aria-label={t('page.tabsLabel')} className="billing-tabs">
        {TABS.map((name) => (
          <button
            key={name}
            role="tab"
            type="button"
            aria-selected={tab === name}
            aria-controls={`tab-${name}`}
            className={tab === name ? 'active' : ''}
            onClick={() => setTab(name)}
          >
            {t(`page.tab.${name}`)}
          </button>
        ))}
      </nav>

      {error ? (
        <div role="alert" className="billing-page__alert">
          {error}
        </div>
      ) : null}
      {message ? <div className="billing-page__notice">{message}</div> : null}

      {tab === 'overview' ? (
        <section
          role="tabpanel"
          id="tab-overview"
          aria-labelledby="billing-page-title"
          className="billing-overview"
        >
          {loadingOverview ? (
            <p role="status" aria-live="polite">
              {t('page.loading')}
            </p>
          ) : overview ? (
            <dl>
              <div>
                <dt>{t('overview.plan')}</dt>
                <dd>{t(`plan.${overview.slug}`)}</dd>
              </div>
              <div>
                <dt>{t('overview.status')}</dt>
                <dd>{t(`status.${overview.status}`)}</dd>
              </div>
              {overview.currentPeriodEnd ? (
                <div>
                  <dt>{t('overview.renewsOn')}</dt>
                  <dd>{new Date(overview.currentPeriodEnd).toLocaleDateString()}</dd>
                </div>
              ) : null}
              {overview.graceEndsAt ? (
                <div>
                  <dt>{t('overview.gracePeriod')}</dt>
                  <dd>{new Date(overview.graceEndsAt).toLocaleDateString()}</dd>
                </div>
              ) : null}
              {overview.cancelAtPeriodEnd ? (
                <div className="billing-overview__cancel">
                  {t('overview.cancelAtPeriodEnd')}
                </div>
              ) : null}
            </dl>
          ) : (
            <p>{t('page.empty')}</p>
          )}
        </section>
      ) : null}

      {tab === 'usage' ? (
        <section
          role="tabpanel"
          id="tab-usage"
          aria-labelledby="billing-page-title"
          className="billing-usage"
        >
          {loadingUsage ? (
            <p role="status" aria-live="polite">
              {t('page.loading')}
            </p>
          ) : usage ? (
            <>
              <p>
                {t('usage.projects', {
                  used: usage.projects.used,
                  cap: usage.projects.cap ?? t('grid.caps.unlimited'),
                })}
              </p>
              <p>{t('usage.retention', { days: usage.retentionDays })}</p>
              <p>{t(`grid.frequency.${usage.frequency}`)}</p>

              <div className="usage-metering">
                <h2>{t('usage.metering.title')}</h2>
                {usage.metering.length === 0 ? (
                  <p>{t('usage.metering.empty')}</p>
                ) : (
                  <table className="usage-metering__table">
                    <thead>
                      <tr>
                        <th scope="col">{t('usage.metering.colProject')}</th>
                        <th scope="col">{t('usage.metering.colSnapshots')}</th>
                        <th scope="col">{t('usage.metering.colSize')}</th>
                        <th scope="col">{t('usage.metering.colLastRun')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.metering.map((m) => (
                        <tr key={m.id}>
                          <th scope="row">{m.name}</th>
                          <td>{m.snapshotCount}</td>
                          <td>{formatBytes(m.sizeBytes)}</td>
                          <td>
                            {m.lastRunAt
                              ? new Date(m.lastRunAt).toLocaleString()
                              : t('usage.metering.never')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {usage.projects.cap !== null && usage.projects.used > usage.projects.cap ? (
                <p role="alert" className="usage-over-cap">
                  {t('usage.overCap')}
                </p>
              ) : null}

              {usage.selectionRequired ? (
                <div className="downgrade-selection">
                  <h2>{t('selection.title')}</h2>
                  <p>{t('selection.help', { cap: usage.projects.cap ?? '' })}</p>
                  <ul>
                    {[...usage.projects.active, ...usage.projects.paused].map((p) => (
                      <li key={p.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={keepIds.includes(p.id)}
                            onChange={() => toggleKeep(p.id)}
                          />{' '}
                          {p.name}
                        </label>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={submitSelection}
                    disabled={keepIds.length === 0}
                  >
                    {t('selection.submit')}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p>{t('page.empty')}</p>
          )}
        </section>
      ) : null}
    </main>
  );
};
