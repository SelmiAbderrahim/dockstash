import { useTranslation } from 'react-i18next';
import { PricingGrid } from './PricingGrid';

export const PricingPage = () => {
  const { t } = useTranslation('billing');
  return (
    <main className="pricing-page" aria-labelledby="pricing-page-title">
      <h1 id="pricing-page-title">{t('grid.title')}</h1>
      <p className="pricing-page__subtitle">{t('grid.subtitle')}</p>
      <PricingGrid />
    </main>
  );
};
