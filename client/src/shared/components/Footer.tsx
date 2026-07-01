import { Link } from 'react-router-dom';
import { useAppSelector } from '@shared/hooks/redux';
import { selectAuthenticated } from '@features/auth';
import { BRAND_NAME } from '@shared/brand';
import { Separator } from '@shared/ui/separator';

const AUTHED_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/logout', label: 'Logout' },
];

const ANON_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/login', label: 'Login' },
  { to: '/register', label: 'Register' },
];

export const Footer = () => {
  const authenticated = useAppSelector(selectAuthenticated);
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
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Separator className="sm:hidden" />
        <p>
          © {year}, {BRAND_NAME}. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
};
