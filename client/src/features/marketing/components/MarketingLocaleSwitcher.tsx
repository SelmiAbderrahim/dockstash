import { GlobeIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { cn } from '@shared/lib/utils';
import {
  SUPPORTED_LOCALES,
  changeLanguage,
  isSupportedLocale,
} from '@shared/i18n';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';

interface MarketingLocaleSwitcherProps {
  className?: string;
  /** Unique id — the switcher renders in the header, footer, and mobile menu. */
  id?: string;
}

/**
 * Locale switcher for the marketing surface. A native `<select>` on purpose:
 * it server-renders with the current locale selected and works pre-hydration.
 * Changing it navigates to the same base path under the new locale prefix and
 * switches the i18n language (same mechanism as the app LanguageSwitcher).
 */
export const MarketingLocaleSwitcher = ({
  className,
  id = 'marketing-locale-switcher',
}: MarketingLocaleSwitcherProps) => {
  const { t } = useTranslation('language');
  const { locale, basePath } = useMarketingRoute();
  const navigate = useNavigate();
  const label = t('switcher.label');

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <GlobeIcon aria-hidden="true" className="size-4 text-muted-foreground" />
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        aria-label={label}
        value={locale}
        onChange={(event) => {
          const next = event.target.value;
          if (isSupportedLocale(next)) {
            navigate(localeHref(basePath, next));
            void changeLanguage(next);
          }
        }}
        className="border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:outline-none"
      >
        {SUPPORTED_LOCALES.map((option) => (
          <option key={option} value={option}>
            {t(`names.${option}`)}
          </option>
        ))}
      </select>
    </div>
  );
};
