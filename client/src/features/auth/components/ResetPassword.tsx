import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { performPasswordReset } from '../store/thunks';
import { clearError, clearMessage } from '../store/slice';
import { selectAuthError, selectAuthMessage, selectAuthenticated } from '../store/selectors';

const resetPasswordSchema = z
  .object({
    password: z.string().min(1, 'Please enter a new password'),
    passwordConfirm: z.string().min(1, 'Please confirm new password'),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    message: 'Passwords must match',
    path: ['password'],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const ResetPassword = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { resetToken } = useParams<{ resetToken: string }>();
  const authenticated = useAppSelector(selectAuthenticated);
  const errorMessage = useAppSelector(selectAuthError);
  const message = useAppSelector(selectAuthMessage);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', passwordConfirm: '' },
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
    if (!resetToken) return;
    const result = await dispatch(performPasswordReset({ token: resetToken, password: values.password }));
    if (performPasswordReset.fulfilled.match(result)) {
      navigate('/login');
    }
  });

  return (
    <form onSubmit={onSubmit}>
      <fieldset>
        <label htmlFor="reset-password">New Password:</label>
        <input id="reset-password" type="password" {...register('password')} />
        {errors.password ? <div className="error">{errors.password.message}</div> : null}
      </fieldset>

      <fieldset>
        <label htmlFor="reset-password-confirm">Confirm New Password:</label>
        <input id="reset-password-confirm" type="password" {...register('passwordConfirm')} />
        {errors.passwordConfirm ? (
          <div className="error">{errors.passwordConfirm.message}</div>
        ) : null}
      </fieldset>

      {errorMessage ? (
        <div role="alert">
          <strong>Oops!</strong> {errorMessage}
        </div>
      ) : null}
      {message ? (
        <div>
          <strong>Success!</strong> {message}
        </div>
      ) : null}
      <button type="submit" disabled={isSubmitting}>
        Change Password
      </button>
    </form>
  );
};
