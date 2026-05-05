import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { loadCookie } from '@shared/utils/cookies';
import { fetchUser } from '../store/thunks';
import { selectProfile } from '../store/selectors';
import { UserInfo } from './UserInfo';

interface CookieUser {
  _id?: string;
}

export const ViewProfile = () => {
  const dispatch = useAppDispatch();
  const profile = useAppSelector(selectProfile);

  useEffect(() => {
    const user = loadCookie<CookieUser>('user');
    const uid = user?._id ?? loadCookie<string>('uid');
    if (uid && typeof uid === 'string') {
      void dispatch(fetchUser(uid));
    }
  }, [dispatch]);

  return <UserInfo profile={profile.email} />;
};
