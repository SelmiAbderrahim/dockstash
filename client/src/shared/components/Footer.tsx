import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@shared/hooks/redux';
import { selectAuthenticated } from '@features/auth';
import { BRAND_NAME } from '@shared/brand';
import { Separator } from '@shared/ui/separator';
import { SOURCE_URL } from '@shared/sourceUrl';

const AUTHED_LINKS = [
  { to: '/dashboard', labelKey: 'nav.dashboard' },
  { to: '/logout', labelKey: 'nav.logout' },
];

const ANON_LINKS = [
  { to: '/login', labelKey: 'nav.login' },
  { to: '/register', labelKey: 'nav.register' },
];

export const Footer = () => {
  const authenticated = useAppSelector(selectAuthenticated);
  const { t } = useTranslation('common');
  const year = new Date().getFullYear();
  const links = authenticated ? AUTHED_LINKS : ANON_LINKS;

  return (
    <footer className="mt-auto border-t">
      <div className="text-muted-foreground container mx-auto flex flex-col items-center gap-4 px-4 py-6 text-sm sm:flex-row sm:justify-between">
        <nav>
          <ul className="flex flex-wrap items-center gap-4">
            {links.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="hover:text-foreground transition-colors">
                  {t(link.labelKey)}
                </Link>
              </li>
            ))}
            <li>
              <a
                href={SOURCE_URL}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground transition-colors"
              >
                {t('footer.source')}
              </a>
            </li>
          </ul>
        </nav>
        <Separator className="sm:hidden" />
        <p>{t('footer.copyright', { year, brand: BRAND_NAME })}</p>
      </div>
    </footer>
  );
};
