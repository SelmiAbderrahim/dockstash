import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { loginUser } from '../store/thunks';
import { clearError } from '../store/slice';
import { selectAuthError, selectAuthenticated } from '../store/selectors';

const buildLoginSchema = (
  requiredEmail: string,
  requiredPassword: string,
) =>
  z.object({
    email: z.string().min(1, requiredEmail),
    password: z.string().min(1, requiredPassword),
  });

type LoginFormValues = z.infer<ReturnType<typeof buildLoginSchema>>;

export const Login = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const errorMessage = useAppSelector(selectAuthError);
  const authenticated = useAppSelector(selectAuthenticated);
  const { t } = useTranslation(['auth', 'errors']);

  const loginSchema = buildLoginSchema(
    t('emailRequired', { ns: 'errors' }),
    t('passwordRequired', { ns: 'errors' }),
  );

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
            <strong>{t('login.errorPrefix')}</strong> {errorMessage}
          </div>
        ) : null}
        <div>
          <label htmlFor="login-email">{t('login.email')}</label>
          <input id="login-email" type="text" {...register('email')} />
          {errors.email ? <div className="error">{errors.email.message}</div> : null}
        </div>
        <div>
          <label htmlFor="login-password">{t('login.password')}</label>
          <input id="login-password" type="password" {...register('password')} />
          {errors.password ? <div className="error">{errors.password.message}</div> : null}
        </div>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('login.submitting') : t('login.submit')}
        </button>
      </form>
      <Link to="/forgot-password">{t('login.forgot')}</Link>
    </div>
  );
};
