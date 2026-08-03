import { useTranslation } from 'react-i18next';
import { BRAND_NAME } from '@shared/brand';
import { SOURCE_URL } from '@shared/sourceUrl';

/**
 * SPEC-01 in-frame footer — muted copyright plus the AGPL-3.0 §13 source
 * offer, which must stay reachable from the running app.
 */
export const AppFrameFooter = () => {
  const { t } = useTranslation('common');
  const year = new Date().getFullYear();
  return (
    <footer className="text-muted-foreground mt-8 flex flex-col gap-3 border-t px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p>{t('footer.copyright', { year, brand: BRAND_NAME })}</p>
      <a
        href={SOURCE_URL}
        target="_blank"
        rel="noreferrer"
        className="hover:text-foreground transition-colors"
      >
        {t('footer.source')}
      </a>
    </footer>
  );
};
