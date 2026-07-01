import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { resendVerification, verifyEmail } from '../store/thunks';
import { clearError, clearMessage } from '../store/slice';
import {
  selectAuthError,
  selectAuthMessage,
  selectPendingVerificationEmail,
} from '../store/selectors';

export const VerifyEmail = () => {
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
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">{t('verify.title')}</h1>

        {token ? (
          <p aria-live="polite">{t('verify.verifying')}</p>
        ) : (
          <p>{t('verify.instructions')}</p>
        )}

        {errorMessage ? (
          <div className="auth-alert" role="alert">
            {errorMessage}
          </div>
        ) : null}
        {message ? (
          <div className="auth-alert auth-alert--success" aria-live="polite">
            {message}
          </div>
        ) : null}

        {pendingEmail ? null : (
          <div className="auth-field">
            <label htmlFor="verify-email">{t('verify.emailLabel')}</label>
            <input
              id="verify-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        )}

        <button className="auth-button" type="button" onClick={onResend} disabled={resending}>
          {resending ? t('verify.resending') : t('verify.resend')}
        </button>
      </div>
    </div>
  );
};
