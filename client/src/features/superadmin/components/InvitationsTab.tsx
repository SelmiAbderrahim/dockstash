import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon, CopyIcon, XCircleIcon } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { useCopyToClipboard } from '@shared/hooks/useCopyToClipboard';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { Empty, EmptyDescription } from '@shared/ui/empty';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@shared/ui/select';
import { Skeleton } from '@shared/ui/skeleton';
import { StatusChip, type StatusTone } from '@shared/ui/status-chip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/ui/table';
import {
  createSuperadminInvitation,
  fetchSuperadminInvitations,
  revokeSuperadminInvitation,
} from '../store/thunks';
import {
  selectActionPending,
  selectLoadingInvitations,
  selectSuperadminError,
  selectSuperadminInvitations,
} from '../store/selectors';
import type {
  GrantDuration,
  GrantablePlan,
  InvitationStatus,
  SuperadminInvitation,
} from '../types';
import { Pagination } from './Pagination';

const PLANS: readonly GrantablePlan[] = ['pro', 'business'];
const DURATIONS: readonly GrantDuration[] = ['one_month', 'one_year'];
const EXPIRY_PRESETS = ['7', '30', '60', '90'] as const;

/** SPEC-A1 status colour language. */
const TONES: Record<InvitationStatus, StatusTone> = {
  pending: 'warning',
  claimed: 'success',
  expired: 'muted',
  revoked: 'destructive',
};

const inviteUrl = (token: string): string => `${window.location.origin}/invite/${token}`;

const isRevocable = (row: SuperadminInvitation): boolean => row.status === 'pending';

export const InvitationsTab = () => {
  const dispatch = useAppDispatch();
  const page = useAppSelector(selectSuperadminInvitations);
  const loading = useAppSelector(selectLoadingInvitations);
  const error = useAppSelector(selectSuperadminError);
  const actionPending = useAppSelector(selectActionPending);
  const { t } = useTranslation('superadmin');
  const { copied, copy } = useCopyToClipboard();

  const [plan, setPlan] = useState<string>('business');
  const [duration, setDuration] = useState<string>('one_year');
  const [expiresInDays, setExpiresInDays] = useState<string>('30');
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!page) void dispatch(fetchSuperadminInvitations({ page: 1 }));
  }, [dispatch, page]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = label.trim();
    const result = await dispatch(
      createSuperadminInvitation({
        planSlug: plan as GrantablePlan,
        grantDuration: duration as GrantDuration,
        expiresInDays: Number(expiresInDays),
        label: trimmed === '' ? undefined : trimmed,
      }),
    );
    if (createSuperadminInvitation.fulfilled.match(result)) {
      setLabel('');
      void dispatch(fetchSuperadminInvitations({ page: 1 }));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            <strong>{t('errorPrefix')}</strong> {error}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle>{t('invitations.createTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="invitation-plan">{t('invitations.planLabel')}</Label>
                <Select value={plan} onValueChange={setPlan}>
                  <SelectTrigger id="invitation-plan" aria-label={t('invitations.planLabel')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t(`invitations.plan.${option}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="invitation-expiry">{t('invitations.expiryLabel')}</Label>
                <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                  <SelectTrigger id="invitation-expiry" aria-label={t('invitations.expiryLabel')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRY_PRESETS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t('invitations.expiryDays', { days: option })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">{t('invitations.durationLabel')}</legend>
              <RadioGroup className="flex gap-6 pt-1" value={duration} onValueChange={setDuration}>
                {DURATIONS.map((option) => (
                  <div key={option} className="flex items-center gap-2">
                    <RadioGroupItem id={`duration-${option}`} value={option} />
                    <Label htmlFor={`duration-${option}`}>
                      {t(`invitations.duration.${option}`)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </fieldset>

            <div className="flex flex-col gap-2">
              <Label htmlFor="invitation-label">{t('invitations.labelLabel')}</Label>
              <Input
                id="invitation-label"
                value={label}
                maxLength={120}
                placeholder={t('invitations.labelPlaceholder')}
                onChange={(event) => setLabel(event.target.value)}
              />
              <p className="text-muted-foreground text-sm">{t('invitations.labelHelp')}</p>
            </div>

            <Button type="submit" loading={actionPending} className="w-fit">
              {t('invitations.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading && !page ? <Skeleton className="h-64" /> : null}

      {page && page.invitations.length === 0 ? (
        <Empty>
          <EmptyDescription>{t('invitations.empty')}</EmptyDescription>
        </Empty>
      ) : null}

      {page && page.invitations.length > 0 ? (
        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle>{t('invitations.listTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('invitations.columns.label')}</TableHead>
                  <TableHead>{t('invitations.columns.plan')}</TableHead>
                  <TableHead>{t('invitations.columns.duration')}</TableHead>
                  <TableHead>{t('invitations.columns.status')}</TableHead>
                  <TableHead>{t('invitations.columns.claimant')}</TableHead>
                  <TableHead>{t('invitations.columns.expires')}</TableHead>
                  <TableHead>{t('invitations.columns.created')}</TableHead>
                  <TableHead>{t('invitations.columns.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.invitations.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.label || '—'}</TableCell>
                    <TableCell>{t(`invitations.plan.${row.plan}`)}</TableCell>
                    <TableCell>{t(`invitations.duration.${row.grantDuration}`)}</TableCell>
                    <TableCell>
                      <StatusChip tone={TONES[row.status]}>
                        {t(`invitations.status.${row.status}`)}
                      </StatusChip>
                    </TableCell>
                    <TableCell>{row.claimedByEmail ?? '—'}</TableCell>
                    <TableCell>{new Date(row.expiresAt).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={t('invitations.copy')}
                          onClick={() => void copy(inviteUrl(row.token))}
                        >
                          {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
                          <span className="ms-2">
                            {copied ? t('invitations.copied') : t('invitations.copy')}
                          </span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="bg-destructive/10 text-destructive"
                          disabled={!isRevocable(row) || actionPending}
                          aria-label={t('invitations.revoke')}
                          onClick={() => void dispatch(revokeSuperadminInvitation({ id: row.id }))}
                        >
                          <XCircleIcon className="size-4" />
                          <span className="ms-2">{t('invitations.revoke')}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              page={page.page}
              pages={page.pages}
              onPageChange={(next) => dispatch(fetchSuperadminInvitations({ page: next }))}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};
