import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { loginUser } from '../store/thunks';
import { clearError } from '../store/slice';
import { selectAuthError, selectAuthenticated } from '../store/selectors';

const loginSchema = z.object({
  email: z.string().min(1, 'Please enter an email'),
  password: z.string().min(1, 'Please enter a password'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const Login = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const errorMessage = useAppSelector(selectAuthError);
  const authenticated = useAppSelector(selectAuthenticated);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  useEffect(() => {
    if (authenticated) {
      navigate('/dashboard');
    }
  }, [authenticated, navigate]);

  const onSubmit = handleSubmit(async (values) => {
    await dispatch(loginUser(values));
  });

  return (
    <div>
      <form onSubmit={onSubmit}>
        {errorMessage ? (
          <div role="alert">
            <strong>Error!</strong> {errorMessage}
          </div>
        ) : null}
        <div>
          <label htmlFor="login-email">Email</label>
          <input id="login-email" type="text" {...register('email')} />
          {errors.email ? <div className="error">{errors.email.message}</div> : null}
        </div>
        <div>
          <label htmlFor="login-password">Password</label>
          <input id="login-password" type="password" {...register('password')} />
          {errors.password ? <div className="error">{errors.password.message}</div> : null}
        </div>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Login'}
        </button>
      </form>
      <Link to="/forgot-password">Forgot Password?</Link>
    </div>
  );
};
