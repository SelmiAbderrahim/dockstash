import { useTranslation } from 'react-i18next';
import { PricingGrid } from './PricingGrid';

export const PricingPage = () => {
  const { t } = useTranslation('billing');
  return (
    <main
      className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10"
      aria-labelledby="pricing-page-title"
    >
      <div className="flex flex-col gap-2 text-center">
        <h1 id="pricing-page-title" className="text-3xl font-bold tracking-tight">
          {t('grid.title')}
        </h1>
        <p className="text-muted-foreground">{t('grid.subtitle')}</p>
      </div>
      <PricingGrid />
    </main>
  );
};
