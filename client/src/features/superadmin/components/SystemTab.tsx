import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Badge } from '@shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { Skeleton } from '@shared/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/ui/table';
import { fetchSuperadminSystem } from '../store/thunks';
import {
  selectSuperadminError,
  selectSuperadminSystem,
} from '../store/selectors';

export const SystemTab = () => {
  const dispatch = useAppDispatch();
  const system = useAppSelector(selectSuperadminSystem);
  const error = useAppSelector(selectSuperadminError);
  const { t } = useTranslation('superadmin');

  useEffect(() => {
    if (!system) dispatch(fetchSuperadminSystem());
  }, [dispatch, system]);

  if (!system) {
    if (error) {
      return (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            <strong>{t('errorPrefix')}</strong> {error}
          </AlertDescription>
        </Alert>
      );
    }
    return <Skeleton className="h-64" />;
  }

  const healthLabel =
    system.health.status === 'ok' ? t('system.statusOk') : t('system.statusDegraded');
  const healthClass =
    system.health.status === 'ok' ? 'text-success' : 'text-destructive';

  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle>{t('system.healthTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className={`font-medium ${healthClass}`}>{healthLabel}</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('system.db')}</span>
            <span>{system.health.db ? t('system.up') : t('system.down')}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('system.redis')}</span>
            <span>
              {system.health.redisConfigured
                ? system.health.redis
                  ? t('system.up')
                  : t('system.down')
                : t('system.notConfigured')}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle>{t('system.schedulerTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('system.schedules')}</span>
            <span>{system.scheduler.schedules}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('system.enabled')}</span>
            <span>{system.scheduler.enabled}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle>{t('system.challengesTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {system.security.recentChallenges.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('system.empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('system.challengeColumns.user')}</TableHead>
                  <TableHead>{t('system.challengeColumns.ip')}</TableHead>
                  <TableHead>{t('system.challengeColumns.attempts')}</TableHead>
                  <TableHead>{t('system.challengeColumns.status')}</TableHead>
                  <TableHead>{t('system.challengeColumns.created')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {system.security.recentChallenges.map((challenge) => (
                  <TableRow key={challenge.id}>
                    <TableCell>{challenge.userId}</TableCell>
                    <TableCell>{challenge.ip}</TableCell>
                    <TableCell>{challenge.attempts}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {challenge.consumedAt
                          ? t('system.challengeConsumed')
                          : t('system.challengePending')}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(challenge.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle>{t('system.eventsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {system.security.recentEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('system.empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('audit.columns.action')}</TableHead>
                  <TableHead>{t('audit.columns.actor')}</TableHead>
                  <TableHead>{t('audit.columns.ip')}</TableHead>
                  <TableHead>{t('audit.columns.date')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {system.security.recentEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{event.action}</TableCell>
                    <TableCell>{event.actorUserId}</TableCell>
                    <TableCell>{event.ip}</TableCell>
                    <TableCell>{new Date(event.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
