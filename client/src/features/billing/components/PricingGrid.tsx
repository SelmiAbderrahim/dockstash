import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import {
  changePlan,
  loadOverview,
  loadPricingTiers,
  startCheckout,
} from '../store/thunks';
import {
  selectBillingError,
  selectBillingOverview,
  selectLoadingTiers,
  selectPricingTiers,
} from '../store/selectors';
import type { PricingTier } from '../types';

const formatPrice = (cents: number): string => `$${(cents / 100).toFixed(0)}`;

export const PricingGrid = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('billing');
  const tiers = useAppSelector(selectPricingTiers);
  const loading = useAppSelector(selectLoadingTiers);
  const overview = useAppSelector(selectBillingOverview);
  const error = useAppSelector(selectBillingError);
  const [interval, setInterval] = useState<'month' | 'year'>('month');

  useEffect(() => {
    void dispatch(loadPricingTiers());
    void dispatch(loadOverview());
  }, [dispatch]);

  const currentSlug = overview?.slug ?? 'free';
  const isExistingPaid = currentSlug !== 'free' && overview?.status === 'active';

  const onSelect = async (tier: PricingTier) => {
    const productId = interval === 'month' ? tier.productIdMonthly : tier.productIdYearly;
    if (!productId) return;
    if (isExistingPaid) {
      void dispatch(changePlan({ productId }));
      return;
    }
    const result = await dispatch(
      startCheckout({
        productId,
        successUrl: `${window.location.origin}/billing?tab=overview`,
        cancelUrl: `${window.location.origin}/billing?tab=overview`,
      }),
    );
    if (startCheckout.fulfilled.match(result)) {
      window.location.href = result.payload.url;
    }
  };

  if (loading) {
    return (
      <div className="pricing-grid" role="status" aria-live="polite">
        {t('grid.loading')}
      </div>
    );
  }

  if (tiers.length === 0) {
    return <div className="pricing-grid pricing-grid--empty">{t('grid.empty')}</div>;
  }

  return (
    <section className="pricing-grid" aria-label={t('grid.title')}>
      {error ? (
        <div role="alert" className="pricing-grid__error">
          {error}
        </div>
      ) : null}

      <div className="pricing-grid__toggle" role="tablist" aria-label={t('grid.intervalLabel')}>
        <button
          type="button"
          role="tab"
          aria-selected={interval === 'month'}
          className={interval === 'month' ? 'active' : ''}
          onClick={() => setInterval('month')}
        >
          {t('grid.monthly')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={interval === 'year'}
          className={interval === 'year' ? 'active' : ''}
          onClick={() => setInterval('year')}
        >
          {t('grid.yearly')} <small>{t('grid.yearlySavings')}</small>
        </button>
      </div>

      <div className="pricing-grid__list">
        {tiers.map((tier) => {
          const price = interval === 'month' ? tier.priceMonthly : tier.priceYearly;
          const productId =
            interval === 'month' ? tier.productIdMonthly : tier.productIdYearly;
          const isCurrent = tier.slug === currentSlug;
          const canSelect = tier.slug !== 'free' && productId !== null && !isCurrent;
          return (
            <article key={tier.slug} className="pricing-tier" aria-labelledby={`tier-${tier.slug}`}>
              <h3 id={`tier-${tier.slug}`}>{tier.name}</h3>
              <p className="pricing-tier__price">
                {tier.slug === 'free' ? t('grid.free') : formatPrice(price)}
                {tier.slug !== 'free' && (
                  <span className="pricing-tier__interval">
                    {' '}
                    /{interval === 'month' ? t('grid.perMonth') : t('grid.perYear')}
                  </span>
                )}
              </p>
              <ul className="pricing-tier__caps">
                <li>
                  {t('grid.caps.projects', {
                    count: tier.caps.projects ?? 0,
                    value:
                      tier.caps.projects === null ? t('grid.caps.unlimited') : tier.caps.projects,
                  })}
                </li>
                <li>{t('grid.caps.retention', { days: tier.caps.retentionDays })}</li>
                <li>{t(`grid.frequency.${tier.caps.frequency}`)}</li>
                {tier.flags.schedules ? <li>{t('grid.flag.schedules')}</li> : null}
                {tier.flags.emailAlerts ? <li>{t('grid.flag.emailAlerts')}</li> : null}
                {tier.flags.multiVps ? <li>{t('grid.flag.multiVps')}</li> : null}
              </ul>
              <button
                type="button"
                className="pricing-tier__cta"
                disabled={!canSelect}
                onClick={() => void onSelect(tier)}
              >
                {isCurrent
                  ? t('grid.cta.current')
                  : isExistingPaid
                    ? t('grid.cta.switch')
                    : t('grid.cta.select')}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
};
