import { Link } from 'react-router-dom';
import { loadCookie } from '@shared/utils/cookies';

interface CookieUser {
  role?: string;
}

const useUserRole = (): string | undefined => {
  const user = loadCookie<CookieUser>('user');
  return user?.role;
};

/**
 * Authenticated landing. Surfaces the four product screens (Projects,
 * Snapshots, Settings, Billing) plus the admin entry for admins. No demo
 * "protected test route" — that placeholder was removed with the demo strip.
 */
export const Dashboard = () => {
  const role = useUserRole();

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <nav className="dashboard-nav">
        <Link to="/projects">Projects</Link>
        <Link to="/snapshots">Snapshots</Link>
        <Link to="/settings">Settings</Link>
        <Link to="/billing">Billing</Link>
        <Link to="/profile">Profile</Link>
        {role === 'Admin' ? <Link to="/admin">Admin</Link> : null}
      </nav>
    </div>
  );
};
