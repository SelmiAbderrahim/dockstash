import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { Spinner } from '@shared/ui/spinner';
import { useDocumentTitle } from '@shared/hooks/useDocumentTitle';
import { parseOAuthCallbackHash } from '../oauth';
import {
  selectAuthError,
  selectAuthenticated,
  selectEmailVerified,
} from '../store/selectors';
import { clearError } from '../store/slice';
import { completeOAuthLogin } from '../store/thunks';

const ERROR_CODES = ['accessDenied', 'invalidState', 'emailUnavailable', 'providerError'] as const;
type OAuthErrorCode = (typeof ERROR_CODES)[number];

function toErrorCode(raw: string | undefined): OAuthErrorCode {
  return (ERROR_CODES as readonly string[]).includes(raw ?? '')
    ? (raw as OAuthErrorCode)
    : 'providerError';
}

/**
 * Landing page for the server's OAuth redirect. The payload arrives in the
 * URL fragment (token or error code); the fragment is scrubbed from history
 * immediately, then this page either completes the session or shows the
 * error.
 */
export const OAuthCallback = () => {
  useDocumentTitle('Signing in');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation('auth');
  const authenticated = useAppSelector(selectAuthenticated);
  const emailVerified = useAppSelector(selectEmailVerified);
  const storeError = useAppSelector(selectAuthError);
  const [errorCode, setErrorCode] = useState<OAuthErrorCode | null>(null);

  useEffect(() => {
    const payload = parseOAuthCallbackHash(window.location.hash);
    // The token must never survive in the address bar / history.
    window.history.replaceState(null, '', window.location.pathname);
    dispatch(clearError());
    if (payload.token) {
      void dispatch(completeOAuthLogin({ token: payload.token }));
      return;
    }
    setErrorCode(toErrorCode(payload.error));
  }, [dispatch]);

  useEffect(() => {
    if (authenticated) {
      // Same branching as Login: dashboard, or verify-email first.
      navigate(emailVerified ? '/dashboard' : '/verify-email', { replace: true });
    }
  }, [authenticated, emailVerified, navigate]);

  const displayError = errorCode ? t(`oauth.errors.${errorCode}`) : storeError || null;

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t('oauth.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {displayError ? (
            <div className="flex flex-col gap-4">
              <Alert variant="destructive" role="alert">
                <AlertDescription>{displayError}</AlertDescription>
              </Alert>
              <Button asChild variant="outline" className="w-full">
                <Link to="/login">{t('oauth.backToLogin')}</Link>
              </Button>
            </div>
          ) : (
            <div
              className="text-muted-foreground flex items-center gap-3 text-sm"
              aria-live="polite"
            >
              <Spinner />
              {t('oauth.completing')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
