import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MoreHorizontalIcon } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Skeleton } from '@shared/ui/skeleton';
import { Empty, EmptyDescription } from '@shared/ui/empty';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@shared/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/ui/table';
import {
  changeUserRole,
  fetchSuperadminUsers,
  forceVerifyUser,
  scheduleUserDeletion,
  setLegalHold,
} from '../store/thunks';
import { setUsersSearch } from '../store/slice';
import {
  selectActionPending,
  selectLoadingUsers,
  selectSuperadminError,
  selectSuperadminUsers,
  selectUsersSearch,
} from '../store/selectors';
import type { SuperadminUser } from '../types';
import {
  ChangeRoleDialog,
  ConfirmActionDialog,
  type UserDialog,
} from './UserActionDialogs';
import { Pagination } from './Pagination';

interface DialogState {
  dialog: UserDialog;
  user: SuperadminUser | null;
}

export const UsersTab = () => {
  const dispatch = useAppDispatch();
  const usersPage = useAppSelector(selectSuperadminUsers);
  const loading = useAppSelector(selectLoadingUsers);
  const error = useAppSelector(selectSuperadminError);
  const search = useAppSelector(selectUsersSearch);
  const actionPending = useAppSelector(selectActionPending);
  const { t } = useTranslation('superadmin');
  const [term, setTerm] = useState(search);
  const [state, setState] = useState<DialogState>({ dialog: null, user: null });

  useEffect(() => {
    if (!usersPage) dispatch(fetchSuperadminUsers({ page: 1 }));
  }, [dispatch, usersPage]);

  const runSearch = () => {
    dispatch(setUsersSearch(term));
    dispatch(fetchSuperadminUsers({ page: 1, search: term || undefined }));
  };

  const goToPage = (page: number) => {
    dispatch(fetchSuperadminUsers({ page, search: search || undefined }));
  };

  const closeDialog = () => setState({ dialog: null, user: null });

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          runSearch();
        }}
      >
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="superadmin-user-search">{t('users.searchLabel')}</Label>
          <Input
            id="superadmin-user-search"
            value={term}
            placeholder={t('users.searchPlaceholder')}
            onChange={(event) => setTerm(event.target.value)}
          />
        </div>
        <Button type="submit">{t('users.searchButton')}</Button>
      </form>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            <strong>{t('errorPrefix')}</strong> {error}
          </AlertDescription>
        </Alert>
      ) : null}

      {loading && !usersPage ? (
        <Skeleton className="h-64" />
      ) : usersPage && usersPage.users.length > 0 ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('users.columns.email')}</TableHead>
                <TableHead>{t('users.columns.role')}</TableHead>
                <TableHead>{t('users.columns.verified')}</TableHead>
                <TableHead>{t('users.columns.legalHold')}</TableHead>
                <TableHead>{t('users.columns.deletion')}</TableHead>
                <TableHead>{t('users.columns.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersPage.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    {user.emailVerified ? t('users.verifiedYes') : t('users.verifiedNo')}
                  </TableCell>
                  <TableCell>{user.legalHold ? t('users.verifiedYes') : t('users.verifiedNo')}</TableCell>
                  <TableCell>
                    {user.deletionScheduledAt
                      ? new Date(user.deletionScheduledAt).toLocaleDateString()
                      : t('users.deletionNone')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t('users.actions.menu')}
                        >
                          <MoreHorizontalIcon className="size-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setState({ dialog: 'role', user })}>
                          {t('users.actions.changeRole')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setState({ dialog: 'verify', user })}>
                          {t('users.actions.forceVerify')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setState({ dialog: 'hold', user })}>
                          {user.legalHold
                            ? t('users.actions.legalHoldOff')
                            : t('users.actions.legalHoldOn')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setState({ dialog: 'delete', user })}>
                          {t('users.actions.scheduleDeletion')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={usersPage.page} pages={usersPage.pages} onPageChange={goToPage} />
        </>
      ) : (
        <Empty>
          <EmptyDescription>{t('users.empty')}</EmptyDescription>
        </Empty>
      )}

      {state.dialog === 'role' && state.user ? (
        <ChangeRoleDialog
          user={state.user}
          onCancel={closeDialog}
          onConfirm={(role) => {
            void dispatch(changeUserRole({ userId: state.user!.id, role }));
            closeDialog();
          }}
        />
      ) : null}

      {state.dialog === 'verify' && state.user ? (
        <ConfirmActionDialog
          title={t('users.dialogs.verifyTitle')}
          description={t('users.dialogs.verifyDescription', { email: state.user.email })}
          onCancel={closeDialog}
          onConfirm={() => {
            void dispatch(forceVerifyUser({ userId: state.user!.id }));
            closeDialog();
          }}
        />
      ) : null}

      {state.dialog === 'hold' && state.user ? (
        <ConfirmActionDialog
          title={
            state.user.legalHold
              ? t('users.dialogs.holdOffTitle')
              : t('users.dialogs.holdOnTitle')
          }
          description={
            state.user.legalHold
              ? t('users.dialogs.holdOffDescription', { email: state.user.email })
              : t('users.dialogs.holdOnDescription', { email: state.user.email })
          }
          onCancel={closeDialog}
          onConfirm={() => {
            void dispatch(
              setLegalHold({ userId: state.user!.id, legalHold: !state.user!.legalHold }),
            );
            closeDialog();
          }}
        />
      ) : null}

      {state.dialog === 'delete' && state.user ? (
        <ConfirmActionDialog
          title={t('users.dialogs.deleteTitle')}
          description={t('users.dialogs.deleteDescription', { email: state.user.email })}
          pending={actionPending}
          onCancel={closeDialog}
          onConfirm={async () => {
            // Keep the dialog open (spinner + disabled buttons) until the request
            // settles; close only on success.
            const res = await dispatch(scheduleUserDeletion({ userId: state.user!.id }));
            if (scheduleUserDeletion.fulfilled.match(res)) closeDialog();
          }}
        />
      ) : null}
    </div>
  );
};
