import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Skeleton } from '@shared/ui/skeleton';
import { Empty, EmptyDescription } from '@shared/ui/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/ui/table';
import { fetchSuperadminAudit } from '../store/thunks';
import { setAuditFilters } from '../store/slice';
import {
  selectAuditFilters,
  selectLoadingAudit,
  selectSuperadminAudit,
  selectSuperadminError,
} from '../store/selectors';
import type { AuditFilters } from '../types';
import { Pagination } from './Pagination';

export const AuditTab = () => {
  const dispatch = useAppDispatch();
  const audit = useAppSelector(selectSuperadminAudit);
  const loading = useAppSelector(selectLoadingAudit);
  const error = useAppSelector(selectSuperadminError);
  const filters = useAppSelector(selectAuditFilters);
  const { t } = useTranslation('superadmin');
  const [draft, setDraft] = useState<AuditFilters>(filters);

  useEffect(() => {
    if (!audit) dispatch(fetchSuperadminAudit({ page: 1, filters }));
  }, [dispatch, audit, filters]);

  const applyFilters = () => {
    dispatch(setAuditFilters(draft));
    dispatch(fetchSuperadminAudit({ page: 1, filters: draft }));
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters();
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="audit-action">{t('audit.filters.action')}</Label>
          <Input
            id="audit-action"
            value={draft.action}
            onChange={(event) => setDraft({ ...draft, action: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="audit-actor">{t('audit.filters.actor')}</Label>
          <Input
            id="audit-actor"
            value={draft.actorUserId}
            onChange={(event) => setDraft({ ...draft, actorUserId: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="audit-from">{t('audit.filters.from')}</Label>
          <Input
            id="audit-from"
            type="date"
            value={draft.from}
            onChange={(event) => setDraft({ ...draft, from: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="audit-to">{t('audit.filters.to')}</Label>
          <Input
            id="audit-to"
            type="date"
            value={draft.to}
            onChange={(event) => setDraft({ ...draft, to: event.target.value })}
          />
        </div>
        <Button type="submit" className="sm:col-span-2 lg:col-span-1">
          {t('audit.filters.apply')}
        </Button>
      </form>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            <strong>{t('errorPrefix')}</strong> {error}
          </AlertDescription>
        </Alert>
      ) : null}

      {loading && !audit ? (
        <Skeleton className="h-64" />
      ) : audit && audit.entries.length > 0 ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('audit.columns.action')}</TableHead>
                <TableHead>{t('audit.columns.actor')}</TableHead>
                <TableHead>{t('audit.columns.target')}</TableHead>
                <TableHead>{t('audit.columns.ip')}</TableHead>
                <TableHead>{t('audit.columns.date')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.action}</TableCell>
                  <TableCell>{entry.actorUserId}</TableCell>
                  <TableCell>
                    {entry.targetType}: {entry.targetId}
                  </TableCell>
                  <TableCell>{entry.ip}</TableCell>
                  <TableCell>{new Date(entry.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={audit.page}
            pages={audit.pages}
            onPageChange={(page) => dispatch(fetchSuperadminAudit({ page, filters }))}
          />
        </>
      ) : (
        <Empty>
          <EmptyDescription>{t('audit.empty')}</EmptyDescription>
        </Empty>
      )}
    </div>
  );
};
