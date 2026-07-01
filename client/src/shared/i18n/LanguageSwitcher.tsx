import { useTranslation } from 'react-i18next';
import { SUPPORTED_LOCALES, changeLanguage, isSupportedLocale } from './index';
import type { SupportedLocale } from './locales';

interface LanguageSwitcherProps {
  className?: string;
  id?: string;
}

export const LanguageSwitcher = ({ className, id = 'language-switcher' }: LanguageSwitcherProps) => {
  const { t, i18n } = useTranslation('language');
  const current = (isSupportedLocale(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'en') as SupportedLocale;

  const label = t('switcher.label');

  return (
    <div className={className}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        aria-label={label}
        value={current}
        onChange={(event) => {
          const next = event.target.value;
          if (isSupportedLocale(next)) void changeLanguage(next);
        }}
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {t(`names.${locale}`)}
          </option>
        ))}
      </select>
    </div>
  );
};
