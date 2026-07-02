import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { GuideMeToggle } from '@features/guide';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { loadCookie } from '@shared/utils/cookies';
import { Avatar, AvatarFallback } from '@shared/ui/avatar';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Card, CardContent } from '@shared/ui/card';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { fetchUser, saveProfile } from '../store/thunks';
import {
  selectProfile,
  selectProfileError,
  selectProfileSaveStatus,
  selectProfileStatus,
} from '../store/selectors';

interface CookieUser {
  /** PublicUser shape (auth thunks store `id`); `_id` kept for legacy cookies. */
  id?: string;
  _id?: string;
}

const resolveUid = (): string | null => {
  const user = loadCookie<CookieUser>('user');
  const uid = user?.id ?? user?._id ?? loadCookie<string>('uid');
  return typeof uid === 'string' && uid ? uid : null;
};

const initialsFor = (firstName: string, lastName: string, email: string | undefined): string => {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.trim();
  if (initials) return initials.toUpperCase();
  return email ? email.slice(0, 2).toUpperCase() : '?';
};

const SavedNotice = ({ children }: { children: React.ReactNode }) => (
  <span role="status" className="text-sm font-medium text-success">
    {children}
  </span>
);

const SaveError = ({ children }: { children: React.ReactNode }) => (
  <span role="alert" className="text-sm font-medium text-destructive">
    {children}
  </span>
);

export const ProfileScreen = () => {
  const { t } = useTranslation('profile');
  const dispatch = useAppDispatch();
  const profile = useAppSelector(selectProfile);
  const status = useAppSelector(selectProfileStatus);
  const saveStatus = useAppSelector(selectProfileSaveStatus);
  const error = useAppSelector(selectProfileError);

  const [uid] = useState(resolveUid);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  useEffect(() => {
    if (uid) {
      void dispatch(fetchUser(uid));
    }
  }, [dispatch, uid]);

  useEffect(() => {
    setFirstName(profile.firstName ?? '');
    setLastName(profile.lastName ?? '');
  }, [profile]);

  return (
    <section
      className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8"
      aria-labelledby="profile-heading"
    >
      <header>
        <h1 id="profile-heading" className="text-2xl font-semibold tracking-tight">
          {t('heading')}
        </h1>
      </header>

      {!uid && (
        <Alert variant="destructive">
          <AlertDescription>{t('errors.noSession')}</AlertDescription>
        </Alert>
      )}

      {uid && status === 'loading' && (
        <p
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {t('loading')}
        </p>
      )}

      {uid && status === 'failed' && (
        <Alert variant="destructive">
          <AlertDescription>{error ?? t('errors.load')}</AlertDescription>
        </Alert>
      )}

      {uid && status === 'succeeded' && (
        <>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <Avatar size="lg">
                <AvatarFallback>
                  {initialsFor(profile.firstName ?? '', profile.lastName ?? '', profile.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1">
                <span className="text-foreground text-sm font-medium">
                  {[profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
                    profile.email}
                </span>
                {profile.role && (
                  <Badge variant="secondary" className="w-fit">
                    {t('identity.roleLabel')}: {profile.role}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!uid) return;
                  void dispatch(saveProfile({ uid, firstName, lastName }));
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="profile-first-name">{t('form.firstName')}</Label>
                    <Input
                      id="profile-first-name"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="profile-last-name">{t('form.lastName')}</Label>
                    <Input
                      id="profile-last-name"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      autoComplete="family-name"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-email">{t('form.email')}</Label>
                  <Input id="profile-email" type="email" value={profile.email ?? ''} disabled />
                  <small className="text-sm text-muted-foreground">{t('form.emailHint')}</small>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={saveStatus === 'loading'}>
                    {saveStatus === 'loading' ? t('form.saving') : t('form.save')}
                  </Button>
                  {saveStatus === 'succeeded' && <SavedNotice>{t('form.saved')}</SavedNotice>}
                  {saveStatus === 'failed' && <SaveError>{error ?? t('errors.save')}</SaveError>}
                </div>
              </form>
            </CardContent>
          </Card>

          <GuideMeToggle />
        </>
      )}
    </section>
  );
};
