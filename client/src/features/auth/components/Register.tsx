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
import { registerUser } from '../store/thunks';
import { clearError } from '../store/slice';
import {
  selectAuthError,
  selectAuthenticated,
  selectEmailVerified,
} from '../store/selectors';

const buildRegisterSchema = (
  requiredFirstName: string,
  requiredLastName: string,
  requiredEmail: string,
  requiredPassword: string,
) =>
  z.object({
    firstName: z.string().min(1, requiredFirstName),
    lastName: z.string().min(1, requiredLastName),
    email: z.string().min(1, requiredEmail),
    password: z.string().min(1, requiredPassword),
  });

type RegisterFormValues = z.infer<ReturnType<typeof buildRegisterSchema>>;

export const Register = () => {
  useDocumentTitle('Create your account');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invite = inviteTokenFrom(searchParams.get('invite'));
  const errorMessage = useAppSelector(selectAuthError);
  const authenticated = useAppSelector(selectAuthenticated);
  const emailVerified = useAppSelector(selectEmailVerified);
  const { t } = useTranslation(['auth', 'errors']);

  const registerSchema = buildRegisterSchema(
    t('firstNameRequired', { ns: 'errors' }),
    t('lastNameRequired', { ns: 'errors' }),
    t('emailRequired', { ns: 'errors' }),
    t('passwordRequired', { ns: 'errors' }),
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
  });

  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  useEffect(() => {
    if (authenticated) {
      // Unverified accounts must confirm their email before the product shell.
      if (!emailVerified) navigate('/verify-email');
      else navigate(invite ? `/invite/${invite}` : '/dashboard');
    }
  }, [authenticated, emailVerified, invite, navigate]);

  const onSubmit = handleSubmit(async (values) => {
    await dispatch(registerUser(values));
  });

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t('register.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            {errorMessage ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>
                  <strong>{t('register.errorPrefix')}</strong> {errorMessage}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="register-first-name">{t('register.firstName')}</Label>
                <Input
                  id="register-first-name"
                  type="text"
                  aria-invalid={!!errors.firstName}
                  {...register('firstName')}
                />
                {errors.firstName ? (
                  <p className="text-destructive text-sm">{errors.firstName.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="register-last-name">{t('register.lastName')}</Label>
                <Input
                  id="register-last-name"
                  type="text"
                  aria-invalid={!!errors.lastName}
                  {...register('lastName')}
                />
                {errors.lastName ? (
                  <p className="text-destructive text-sm">{errors.lastName.message}</p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="register-email">{t('register.email')}</Label>
              <Input
                id="register-email"
                type="text"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email ? (
                <p className="text-destructive text-sm">{errors.email.message}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="register-password">{t('register.password')}</Label>
              <Input
                id="register-password"
                type="password"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              {errors.password ? (
                <p className="text-destructive text-sm">{errors.password.message}</p>
              ) : null}
            </div>
            <Button type="submit" loading={isSubmitting} className="w-full">
              {t('register.submit')}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t('register.termsPrefix')}{' '}
              <Link to="/terms" className="underline underline-offset-4 hover:text-foreground">
                {t('register.termsOfService')}
              </Link>{' '}
              {t('register.termsAnd')}{' '}
              <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
                {t('register.privacyPolicy')}
              </Link>
              .
            </p>
          </form>
          <Button asChild variant="link" className="mt-2 px-0">
            <Link to={invite ? `/login?invite=${invite}` : '/login'}>{t('register.login')}</Link>
          </Button>
          <OAuthButtons />
        </CardContent>
      </Card>
    </div>
  );
};
