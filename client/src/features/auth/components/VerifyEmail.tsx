import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { resendVerification, verifyEmail } from '../store/thunks';
import { clearError, clearMessage } from '../store/slice';
import {
  selectAuthError,
  selectAuthMessage,
  selectPendingVerificationEmail,
} from '../store/selectors';

export const VerifyEmail = () => {
  useDocumentTitle('Verify your email');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation('auth');
  const errorMessage = useAppSelector(selectAuthError);
  const message = useAppSelector(selectAuthMessage);
  const pendingEmail = useAppSelector(selectPendingVerificationEmail);

  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);

  // Consume the token when the page is opened from the email link.
  useEffect(() => {
    if (!token) return;
    void dispatch(verifyEmail(token)).then((result) => {
      if (verifyEmail.fulfilled.match(result)) {
        navigate('/dashboard');
      }
    });
  }, [token, dispatch, navigate]);

  useEffect(() => {
    return () => {
      dispatch(clearError());
      dispatch(clearMessage());
    };
  }, [dispatch]);

  const onResend = async () => {
    const target = pendingEmail || email;
    if (!target) return;
    setResending(true);
    await dispatch(resendVerification(target));
    setResending(false);
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t('verify.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {token ? (
            <p className="text-muted-foreground text-sm" aria-live="polite">
              {t('verify.verifying')}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">{t('verify.instructions')}</p>
          )}

          {errorMessage ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
          {message ? (
            <Alert role="status" aria-live="polite">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}

          {pendingEmail ? null : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="verify-email">{t('verify.emailLabel')}</Label>
              <Input
                id="verify-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}

          <Button type="button" onClick={onResend} disabled={resending} className="w-full">
            {resending ? t('verify.resending') : t('verify.resend')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
