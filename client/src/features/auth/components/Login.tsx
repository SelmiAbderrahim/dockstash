import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { PageMeta } from '@shared/seo';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@shared/ui/card';
import { loginUser, verifyLoginOtp } from '../store/thunks';
import { cancelOtp, clearError } from '../store/slice';
import {
  selectAuthError,
  selectAuthenticated,
  selectEmailVerified,
  selectOtpChallengeId,
  selectUserRole,
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

const buildOtpSchema = (invalidCode: string) =>
  z.object({
    code: z.string().regex(/^\d{6}$/, invalidCode),
  });

type OtpFormValues = z.infer<ReturnType<typeof buildOtpSchema>>;

export const Login = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const errorMessage = useAppSelector(selectAuthError);
  const authenticated = useAppSelector(selectAuthenticated);
  const emailVerified = useAppSelector(selectEmailVerified);
  const role = useAppSelector(selectUserRole);
  const otpChallengeId = useAppSelector(selectOtpChallengeId);
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

  const otpSchema = buildOtpSchema(t('otpCodeInvalid', { ns: 'errors' }));
  const {
    register: registerOtp,
    handleSubmit: handleOtpSubmit,
    formState: { errors: otpErrors, isSubmitting: isOtpSubmitting },
  } = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: '' },
  });

  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  useEffect(() => {
    if (authenticated) {
      // Superadmins land on their console; everyone else keeps the existing flow.
      navigate(role === 'Superadmin' ? '/superadmin' : emailVerified ? '/dashboard' : '/verify-email');
    }
  }, [authenticated, emailVerified, role, navigate]);

  const onSubmit = handleSubmit(async (values) => {
    await dispatch(loginUser(values));
  });

  const onOtpSubmit = handleOtpSubmit(async (values) => {
    await dispatch(verifyLoginOtp({ challengeId: otpChallengeId, code: values.code }));
  });

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-8">
      <PageMeta
        title="Log in"
        description="Log in to your Dockstash account to manage Docker backup projects, snapshots, and restore drills."
      />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            {otpChallengeId ? t('otp.title') : t('login.submit')}
          </CardTitle>
        </CardHeader>
        {otpChallengeId ? (
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={onOtpSubmit}>
              <p className="text-muted-foreground text-sm">{t('otp.instructions')}</p>
              {errorMessage ? (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>
                    <strong>{t('login.errorPrefix')}</strong> {errorMessage}
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-otp-code">{t('otp.code')}</Label>
                <Input
                  id="login-otp-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  aria-invalid={!!otpErrors.code}
                  {...registerOtp('code')}
                />
                {otpErrors.code ? (
                  <p className="text-destructive text-sm">{otpErrors.code.message}</p>
                ) : null}
              </div>
              <Button type="submit" disabled={isOtpSubmitting} className="w-full">
                {isOtpSubmitting ? t('otp.submitting') : t('otp.submit')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => dispatch(cancelOtp())}
              >
                {t('otp.back')}
              </Button>
            </form>
          </CardContent>
        ) : (
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
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? t('login.submitting') : t('login.submit')}
            </Button>
          </form>
          <Button asChild variant="link" className="mt-2 px-0">
            <Link to="/forgot-password">{t('login.forgot')}</Link>
          </Button>
        </CardContent>
        )}
      </Card>
    </div>
  );
};
