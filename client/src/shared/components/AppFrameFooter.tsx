import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BRAND_NAME } from '@shared/brand';

const LINKS = [
  { to: '/guides', labelKey: 'sidebar.footer.guides' },
  { to: '/security', labelKey: 'sidebar.footer.security' },
  { to: '/privacy', labelKey: 'sidebar.footer.privacy' },
  { to: '/terms', labelKey: 'sidebar.footer.terms' },
];

/** SPEC-01 in-frame footer — muted copyright + end-aligned muted text links. */
export const AppFrameFooter = () => {
  const { t } = useTranslation('common');
  const year = new Date().getFullYear();
  return (
    <footer className="text-muted-foreground mt-8 flex flex-col gap-3 border-t px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p>{t('footer.copyright', { year, brand: BRAND_NAME })}</p>
      <nav>
        <ul className="flex flex-wrap items-center gap-4">
          {LINKS.map((link) => (
            <li key={link.to}>
              <Link to={link.to} className="hover:text-foreground transition-colors">
                {t(link.labelKey)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  );
};
