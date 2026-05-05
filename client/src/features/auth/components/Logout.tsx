import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@shared/hooks/redux';
import { logoutUser } from '../store/thunks';

export const Logout = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    void dispatch(logoutUser(undefined)).then(() => {
      navigate('/login');
    });
  }, [dispatch, navigate]);

  return <div>Sorry to see you go!</div>;
};
