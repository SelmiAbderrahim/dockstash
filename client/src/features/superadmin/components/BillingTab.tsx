import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
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
import { fetchSuperadminBilling } from '../store/thunks';
import {
  selectLoadingBilling,
  selectSuperadminBilling,
  selectSuperadminError,
} from '../store/selectors';
import { Pagination } from './Pagination';

export const BillingTab = () => {
  const dispatch = useAppDispatch();
  const billing = useAppSelector(selectSuperadminBilling);
  const loading = useAppSelector(selectLoadingBilling);
  const error = useAppSelector(selectSuperadminError);
  const { t } = useTranslation('superadmin');

  useEffect(() => {
    if (!billing) dispatch(fetchSuperadminBilling({ page: 1 }));
  }, [dispatch, billing]);

  if (loading && !billing) return <Skeleton className="h-64" />;

  if (error && !billing) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>
          <strong>{t('errorPrefix')}</strong> {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!billing || billing.customers.length === 0) {
    return (
      <Empty>
        <EmptyDescription>{t('billing.empty')}</EmptyDescription>
      </Empty>
    );
  }

  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>{t('billing.customersTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('billing.columns.email')}</TableHead>
              <TableHead>{t('billing.columns.provider')}</TableHead>
              <TableHead>{t('billing.columns.customerId')}</TableHead>
              <TableHead>{t('billing.columns.created')}</TableHead>
              <TableHead>{t('billing.columns.subscriptions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {billing.customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell>{customer.email}</TableCell>
                <TableCell>{customer.provider}</TableCell>
                <TableCell>{customer.providerCustomerId}</TableCell>
                <TableCell>{new Date(customer.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  {customer.subscriptions.length === 0
                    ? t('billing.noSubscriptions')
                    : customer.subscriptions
                        .map((sub) =>
                          t('billing.subscription', { plan: sub.planSlug, status: sub.status }),
                        )
                        .join(', ')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination
          page={billing.page}
          pages={billing.pages}
          onPageChange={(page) => dispatch(fetchSuperadminBilling({ page }))}
        />
      </CardContent>
    </Card>
  );
};
