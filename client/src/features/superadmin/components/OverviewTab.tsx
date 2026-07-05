import { useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  ArchiveIcon,
  CheckCircleIcon,
  DatabaseIcon,
  FolderIcon,
  PauseIcon,
  UserPlusIcon,
  UsersIcon,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { IconTile } from '@shared/ui/icon-tile';
import { Skeleton } from '@shared/ui/skeleton';
import { StatCard } from '@shared/ui/stat-card';
import { fetchSuperadminStats } from '../store/thunks';
import {
  selectSuperadminError,
  selectSuperadminStats,
} from '../store/selectors';

const tile = (Icon: LucideIcon) => (
  <IconTile size="sm" tone="muted">
    <Icon aria-hidden="true" />
  </IconTile>
);

export const OverviewTab = () => {
  const dispatch = useAppDispatch();
  const stats = useAppSelector(selectSuperadminStats);
  const error = useAppSelector(selectSuperadminError);
  const { t } = useTranslation('superadmin');

  useEffect(() => {
    if (!stats) dispatch(fetchSuperadminStats());
  }, [dispatch, stats]);

  if (!stats) {
    if (error) {
      return (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            <strong>{t('errorPrefix')}</strong> {error}
          </AlertDescription>
        </Alert>
      );
    }
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-20" />
        ))}
      </div>
    );
  }

  const maxCount = stats.subscriptions.reduce((max, row) => Math.max(max, row.count), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label={t('overview.usersTotal')} value={stats.users.total} icon={tile(UsersIcon)} />
        <StatCard label={t('overview.usersNew7d')} value={stats.users.new7d} icon={tile(UserPlusIcon)} />
        <StatCard
          label={t('overview.usersNew30d')}
          value={stats.users.new30d}
          icon={tile(UserPlusIcon)}
        />
        <StatCard
          label={t('overview.verifiedPct')}
          value={`${stats.users.verifiedPct}%`}
          icon={tile(CheckCircleIcon)}
        />
        <StatCard label={t('overview.projects')} value={stats.projects.total} icon={tile(FolderIcon)} />
        <StatCard
          label={t('overview.projectsPaused')}
          value={stats.projects.paused}
          icon={tile(PauseIcon)}
        />
        <StatCard
          label={t('overview.backupsWithSuccess')}
          value={stats.backups.projectsWithSuccess}
          icon={tile(ArchiveIcon)}
        />
        <StatCard
          label={t('overview.snapshots')}
          value={stats.snapshots.total}
          icon={tile(DatabaseIcon)}
        />
        <StatCard
          label={t('overview.repoBytes')}
          value={stats.snapshots.repoBytes}
          icon={tile(DatabaseIcon)}
        />
      </div>

      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle>{t('overview.subscriptionsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {stats.subscriptions.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('overview.subscriptionsEmpty')}</p>
          ) : (
            stats.subscriptions.map((row) => (
              <div key={`${row.planSlug}:${row.status}`} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground font-medium">
                    {row.planSlug} · {row.status}
                  </span>
                  <span className="text-muted-foreground">{row.count}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-foreground"
                    style={{ width: `${maxCount ? (row.count / maxCount) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
