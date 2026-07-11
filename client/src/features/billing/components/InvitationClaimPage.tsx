import { useEffect, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRightIcon } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { selectAuthenticated, selectEmailVerified } from '@features/auth';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { PageMeta } from '@shared/seo';
import { claimInvitation, resolveInvitation } from '../store/thunks';
import {
  selectClaimError,
  selectClaimResult,
  selectClaiming,
  selectInvite,
  selectInviteError,
} from '../store/selectors';

const Shell = ({ title, children }: { title: string; children: ReactNode }) => (
  <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12">
    <PageMeta title={title} description="Activate your Dockstash invitation." />
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  </main>
);

/**
 * `/invite/:token`. Public route: the offer summary resolves logged-out, then
 * the user is bounced through `/login?invite=<token>` and back here. After the
 * grant lapses the existing `/billing?tab=plans` surface takes over — this page
 * never renders an upgrade UI of its own.
 */
export const InvitationClaimPage = () => {
  const { token = '' } = useParams<{ token: string }>();
  const dispatch = useAppDispatch();
  const { t } = useTranslation('billing');
  const authenticated = useAppSelector(selectAuthenticated);
  const emailVerified = useAppSelector(selectEmailVerified);
  const invite = useAppSelector(selectInvite);
  const inviteError = useAppSelector(selectInviteError);
  const claiming = useAppSelector(selectClaiming);
  const claimError = useAppSelector(selectClaimError);
  const claimResult = useAppSelector(selectClaimResult);

  useEffect(() => {
    void dispatch(resolveInvitation({ token }));
  }, [dispatch, token]);

  if (!authenticated) {
    return <Navigate to={`/login?invite=${token}`} replace />;
  }

  if (claimResult) {
    return (
      <Shell title={t('invite.success.title')}>
        <p className="text-muted-foreground">
          {t('invite.success.body', {
            plan: t(`plan.${claimResult.plan}`),
            endsOn: new Date(claimResult.currentPeriodEnd).toLocaleDateString(),
          })}
        </p>
        <Button asChild className="w-fit">
          <Link to="/dashboard">
            {t('invite.success.cta')}
            <ArrowRightIcon className="ms-2 size-4" />
          </Link>
        </Button>
      </Shell>
    );
  }

  if (!emailVerified) {
    return (
      <Shell title={t('invite.verifyFirst.title')}>
        <p className="text-muted-foreground">{t('invite.verifyFirst.body')}</p>
        <Button asChild className="w-fit">
          <Link to="/verify-email">{t('invite.verifyFirst.cta')}</Link>
        </Button>
      </Shell>
    );
  }

  if (inviteError) {
    return (
      <Shell title={t('invite.dead.title')}>
        <Alert variant="destructive" role="alert">
          <AlertDescription>{inviteError}</AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="w-fit">
          <Link to="/dashboard">{t('invite.dead.cta')}</Link>
        </Button>
      </Shell>
    );
  }

  if (!invite) {
    return (
      <Shell title={t('invite.offer.title')}>
        <p role="status" aria-live="polite" className="text-muted-foreground">
          {t('page.loading')}
        </p>
      </Shell>
    );
  }

  if (invite.status !== 'pending') {
    return (
      <Shell title={t('invite.dead.title')}>
        <p className="text-muted-foreground">{t(`invite.dead.${invite.status}`)}</p>
        <Button asChild variant="outline" className="w-fit">
          <Link to="/billing?tab=plans">{t('invite.dead.plansCta')}</Link>
        </Button>
      </Shell>
    );
  }

  return (
    <Shell title={t('invite.offer.title')}>
      {claimError ? (
        <>
          <Alert variant="destructive" role="alert">
            <AlertDescription>{claimError}</AlertDescription>
          </Alert>
          <Button asChild variant="outline" className="w-fit">
            <Link to="/billing?tab=plans">{t('invite.dead.plansCta')}</Link>
          </Button>
        </>
      ) : null}
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground text-sm">{t('invite.offer.plan')}</dt>
          <dd className="font-medium">{t(`plan.${invite.plan}`)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground text-sm">{t('invite.offer.duration')}</dt>
          <dd className="font-medium">{t(`invite.duration.${invite.grantDuration}`)}</dd>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <dt className="text-muted-foreground text-sm">{t('invite.offer.linkExpires')}</dt>
          <dd className="font-medium">{new Date(invite.expiresAt).toLocaleDateString()}</dd>
        </div>
      </dl>
      <Button
        type="button"
        className="w-fit"
        loading={claiming}
        onClick={() => void dispatch(claimInvitation({ token }))}
      >
        {t('invite.offer.activate')}
      </Button>
    </Shell>
  );
};
