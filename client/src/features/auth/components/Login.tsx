import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { useDocumentTitle } from '@shared/hooks/useDocumentTitle';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@shared/ui/card';
import { OAuthButtons } from './OAuthButtons';
import { inviteTokenFrom } from '../inviteToken';
import { loginUser } from '../store/thunks';
import { clearError } from '../store/slice';
import {
  selectAuthError,
  selectAuthenticated,
  selectEmailVerified,
} from '../store/selectors';

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
  useDocumentTitle('Log in');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invite = inviteTokenFrom(searchParams.get('invite'));
  const errorMessage = useAppSelector(selectAuthError);
  const authenticated = useAppSelector(selectAuthenticated);
  const emailVerified = useAppSelector(selectEmailVerified);
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
      // A verified invitee lands on the claim page; everyone else on the
      // dashboard (or the verification screen first).
      if (!emailVerified) navigate('/verify-email');
      else navigate(invite ? `/invite/${invite}` : '/dashboard');
    }
  }, [authenticated, emailVerified, invite, navigate]);

  const onSubmit = handleSubmit(async (values) => {
    await dispatch(loginUser(values));
  });

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t('login.submit')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            {errorMessage ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>
                  <strong>{t('login.errorPrefix')}</strong> {errorMessage}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-email">{t('login.email')}</Label>
              <Input
                id="login-email"
                type="text"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email ? (
                <p className="text-destructive text-sm">{errors.email.message}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-password">{t('login.password')}</Label>
              <Input
                id="login-password"
                type="password"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              {errors.password ? (
                <p className="text-destructive text-sm">{errors.password.message}</p>
              ) : null}
            </div>
            <Button type="submit" loading={isSubmitting} className="w-full">
              {t('login.submit')}
            </Button>
          </form>
          <Button asChild variant="link" className="mt-2 px-0">
            <Link to="/forgot-password">{t('login.forgot')}</Link>
          </Button>
          <Button asChild variant="link" className="mt-2 px-0 ms-4">
            <Link to={invite ? `/register?invite=${invite}` : '/register'}>
              {t('login.register')}
            </Link>
          </Button>
          <OAuthButtons />
        </CardContent>
      </Card>
    </div>
  );
};
