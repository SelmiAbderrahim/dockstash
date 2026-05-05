import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { fetchProtected, selectAuthContent } from '@features/auth';
import { loadCookie } from '@shared/utils/cookies';

interface CookieUser {
  role?: string;
}

const useUserRole = (): string | undefined => {
  const user = loadCookie<CookieUser>('user');
  return user?.role;
};

export const Dashboard = () => {
  const dispatch = useAppDispatch();
  const content = useAppSelector(selectAuthContent);
  const role = useUserRole();

  useEffect(() => {
    void dispatch(fetchProtected());
  }, [dispatch]);

  return (
    <div>
      <Link to="/dashboard/inbox">Inbox</Link> | <Link to="/profile">View Profile</Link> |{' '}
      <Link to="/billing/settings">Billing</Link>
      {role === 'Admin' ? (
        <div className="admin-menu">
          <Link to="/admin">Admin</Link>
        </div>
      ) : null}
      {role === 'Owner' ? <div className="trainer-menu">Owner menu coming soon.</div> : null}
      {role === 'Client' ? <div className="client-menu">Client menu coming soon.</div> : null}
      <p>{content}</p>
    </div>
  );
};
