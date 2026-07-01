import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { requestPasswordReset } from '../store/thunks';
import { clearError, clearMessage } from '../store/slice';
import { selectAuthError, selectAuthMessage, selectAuthenticated } from '../store/selectors';

const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Please enter an email'),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const ForgotPassword = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const authenticated = useAppSelector(selectAuthenticated);
  const errorMessage = useAppSelector(selectAuthError);
  const message = useAppSelector(selectAuthMessage);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  useEffect(() => {
    if (authenticated) {
      navigate('/dashboard');
    }
  }, [authenticated, navigate]);

  useEffect(() => {
    return () => {
      dispatch(clearError());
      dispatch(clearMessage());
    };
  }, [dispatch]);

  const onSubmit = handleSubmit(async (values) => {
    await dispatch(requestPasswordReset({ email: values.email }));
  });

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">Reset your password</h1>
        <form className="auth-form" onSubmit={onSubmit}>
          {errorMessage ? (
            <div className="auth-alert" role="alert">
              <strong>Error!</strong> {errorMessage}
            </div>
          ) : null}
          {message ? (
            <div className="auth-alert auth-alert--success">
              <strong>Success!</strong> {message}
            </div>
          ) : null}
          <div className="auth-field">
            <label htmlFor="forgot-email">Email</label>
            <input id="forgot-email" type="text" {...register('email')} />
            {errors.email ? <div className="error">{errors.email.message}</div> : null}
          </div>
          <button className="auth-button" type="submit" disabled={isSubmitting}>
            Reset Password
          </button>
        </form>
      </div>
    </div>
  );
};
