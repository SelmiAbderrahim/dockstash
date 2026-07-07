import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { Button } from '@shared/ui/button';
import { Badge } from '@shared/ui/badge';
import { Alert, AlertDescription } from '@shared/ui/alert';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@shared/ui/card';
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

/** The plan we surface as recommended (ring + badge). */
const RECOMMENDED_SLUG: PricingTier['slug'] = 'pro';

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

  const productIdFor = (tier: PricingTier) =>
    interval === 'month' ? tier.productIdMonthly : tier.productIdYearly;
  // When payments are unconfigured every paid tier ships a null product ID, so
  // no upgrade is purchasable. Surface that explicitly instead of leaving a row
  // of dead disabled buttons with no explanation.
  const upgradesAvailable = tiers.some(
    (tier) => tier.slug !== 'free' && productIdFor(tier) !== null,
  );

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
      <div className="py-8 text-center text-muted-foreground" role="status" aria-live="polite">
        {t('grid.loading')}
      </div>
    );
  }

  if (tiers.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">{t('grid.empty')}</div>
    );
  }

  return (
    <section className="flex flex-col gap-6" aria-label={t('grid.title')}>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!upgradesAvailable ? (
        <Alert>
          <AlertDescription>{t('grid.unavailable')}</AlertDescription>
        </Alert>
      ) : null}

      <div
        className="inline-flex w-fit items-center gap-1 self-center rounded-lg border bg-muted p-1"
        role="tablist"
        aria-label={t('grid.intervalLabel')}
      >
        <button
          type="button"
          role="tab"
          aria-selected={interval === 'month'}
          className={cn(
            'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            interval === 'month'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => setInterval('month')}
        >
          {t('grid.monthly')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={interval === 'year'}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            interval === 'year'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => setInterval('year')}
        >
          {t('grid.yearly')}{' '}
          <Badge variant="secondary" className="rounded-md text-xs font-normal">
            {t('grid.yearlySavings')}
          </Badge>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tiers.map((tier) => {
          const price = interval === 'month' ? tier.priceMonthly : tier.priceYearly;
          const productId = productIdFor(tier);
          const isCurrent = tier.slug === currentSlug;
          const canSelect = tier.slug !== 'free' && productId !== null && !isCurrent;
          const isRecommended = tier.slug === RECOMMENDED_SLUG;
          return (
            <Card
              key={tier.slug}
              aria-labelledby={`tier-${tier.slug}`}
              className={cn(
                'relative flex flex-col',
                isRecommended && 'border-primary ring-1 ring-primary',
              )}
            >
              {isRecommended ? (
                <Badge
                  aria-hidden="true"
                  className="absolute -top-2.5 start-6 size-6 rounded-full p-0"
                >
                  <Star className="fill-current" />
                </Badge>
              ) : null}
              <CardHeader>
                <h3 id={`tier-${tier.slug}`} className="text-lg font-semibold">
                  {tier.name}
                </h3>
                <p className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">
                    {tier.slug === 'free' ? t('grid.free') : formatPrice(price)}
                  </span>
                  {tier.slug !== 'free' && (
                    <span className="text-sm text-muted-foreground">
                      /{interval === 'month' ? t('grid.perMonth') : t('grid.perYear')}
                    </span>
                  )}
                </p>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="flex flex-col gap-2 text-sm">
                  <li>
                    {t('grid.caps.projects', {
                      count: tier.caps.projects ?? 0,
                      value:
                        tier.caps.projects === null
                          ? t('grid.caps.unlimited')
                          : tier.caps.projects,
                    })}
                  </li>
                  <li>
                    {t('grid.caps.agents', {
                      value:
                        tier.caps.agents === null
                          ? t('grid.caps.unlimited')
                          : tier.caps.agents,
                    })}
                  </li>
                  <li>{t('grid.caps.retention', { days: tier.caps.retentionDays })}</li>
                  <li>{t(`grid.frequency.${tier.caps.frequency}`)}</li>
                  {tier.flags.schedules ? <li>{t('grid.flag.schedules')}</li> : null}
                  {tier.flags.emailAlerts ? <li>{t('grid.flag.emailAlerts')}</li> : null}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  type="button"
                  variant={isRecommended && canSelect ? 'default' : 'outline'}
                  className="w-full"
                  disabled={!canSelect}
                  onClick={() => void onSelect(tier)}
                >
                  {isCurrent
                    ? t('grid.cta.current')
                    : tier.slug !== 'free' && productId === null
                      ? t('grid.cta.unavailable')
                      : isExistingPaid
                        ? t('grid.cta.switch')
                        : t('grid.cta.select')}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </section>
  );
};
