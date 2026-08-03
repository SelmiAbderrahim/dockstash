import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader } from '@shared/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@shared/ui/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/ui/table';
import { fetchProjectJobs } from '../store/thunks';
import {
  selectProjectJobs,
  selectProjectJobsError,
  selectProjectJobsStatus,
} from '../store/selectors';
import type { PassFail, Project, ProjectJob } from '../types';

/** SPEC-A2 tint recipe: token at /10 for the fill, full-strength for the text. */
const CHIP_CLASSES: Record<'pass' | 'fail' | 'muted' | 'pending', string> = {
  pass: 'bg-success/10 text-success',
  fail: 'bg-destructive/10 text-destructive',
  pending: 'bg-warning/10 text-warning',
  muted: 'bg-muted text-muted-foreground',
};

const Chip = ({ tone, label }: { tone: keyof typeof CHIP_CLASSES; label: string }) => (
  <span
    data-tone={tone}
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CHIP_CLASSES[tone]}`}
  >
    {label}
  </span>
);

interface StampCardProps {
  title: string;
  at: string | null;
  status: PassFail | 'success' | 'failed' | string;
  detail?: string;
}

const StampCard = ({ title, at, status, detail }: StampCardProps) => {
  const { t, i18n } = useTranslation('projectDetail');
  const ok = status === 'pass' || status === 'success';
  const tone: keyof typeof CHIP_CLASSES = !at ? 'muted' : ok ? 'pass' : 'fail';
  const label = !at ? t('history.never') : ok ? t('history.ok') : t('history.failed');
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-xs">
      <span className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
        {title}
      </span>
      <span className="flex items-center gap-2 text-sm">
        <Chip tone={tone} label={label} />
        {at && <span>{new Date(at).toLocaleString(i18n.language)}</span>}
      </span>
      {detail && <p className="text-muted-foreground text-sm break-all">{detail}</p>}
    </div>
  );
};

const jobTone = (status: ProjectJob['status']): keyof typeof CHIP_CLASSES => {
  if (status === 'succeeded') return 'pass';
  if (status === 'failed') return 'fail';
  if (status === 'pending') return 'pending';
  return 'muted';
};

interface HistoryPanelProps {
  project: Project;
}

export const HistoryPanel = ({ project }: HistoryPanelProps) => {
  const { t, i18n } = useTranslation('projectDetail');
  const dispatch = useAppDispatch();
  const jobs = useAppSelector(selectProjectJobs);
  const status = useAppSelector(selectProjectJobsStatus);
  const error = useAppSelector(selectProjectJobsError);
  const [openLogsId, setOpenLogsId] = useState<string | null>(null);

  useEffect(() => {
    void dispatch(fetchProjectJobs({ projectId: project.id }));
  }, [dispatch, project.id]);

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(i18n.language) : '—';

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StampCard
          title={t('history.cards.backup')}
          at={project.lastRunAt}
          status={project.lastStatus}
          detail={project.lastStatus === 'failed' ? project.lastError : undefined}
        />
        <StampCard
          title={t('history.cards.restore')}
          at={project.lastRestoreAt}
          status={project.lastRestoreStatus}
          detail={project.lastRestoreDetail || undefined}
        />
        <StampCard
          title={t('history.cards.drill')}
          at={project.lastDrillAt}
          status={project.lastDrillStatus}
          detail={project.lastDrillDetail || undefined}
        />
      </div>

      <Card aria-labelledby="history-jobs-heading">
        <CardHeader>
          <h2 id="history-jobs-heading" className="text-base leading-none font-semibold">
            {t('history.heading')}
          </h2>
          <p className="text-muted-foreground text-sm">{t('history.lede')}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {status === 'loading' && (
            <p
              role="status"
              aria-live="polite"
              className="text-muted-foreground inline-flex items-center gap-2 text-sm"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t('loading')}
            </p>
          )}

          {status === 'failed' && (
            <Alert variant="destructive">
              {/* The slice always records a fallback message on rejection. */}
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {status === 'succeeded' && jobs.length === 0 && (
            <Empty data-testid="history-empty">
              <EmptyHeader>
                <EmptyTitle>{t('history.empty.title')}</EmptyTitle>
                <EmptyDescription>{t('history.empty.hint')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {jobs.length > 0 && (
            <div className="rounded-lg border">
              <Table aria-label={t('history.tableLabel')}>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">{t('history.columns.kind')}</TableHead>
                    <TableHead className="text-start">{t('history.columns.status')}</TableHead>
                    <TableHead className="text-start">{t('history.columns.started')}</TableHead>
                    <TableHead className="text-start">{t('history.columns.finished')}</TableHead>
                    <TableHead className="text-start">{t('history.columns.snapshot')}</TableHead>
                    <TableHead className="text-end">
                      <span className="sr-only">{t('history.columns.logs')}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <JobRows
                      key={job.id}
                      job={job}
                      open={openLogsId === job.id}
                      onToggle={() =>
                        setOpenLogsId((prev) => (prev === job.id ? null : job.id))
                      }
                      fmt={fmt}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

interface JobRowsProps {
  job: ProjectJob;
  open: boolean;
  onToggle: () => void;
  fmt: (iso: string | null) => string;
}

const JobRows = ({ job, open, onToggle, fmt }: JobRowsProps) => {
  const { t } = useTranslation('projectDetail');
  const hasDetails = job.logTail.length > 0 || Boolean(job.error);
  return (
    <>
      <TableRow>
        <TableCell>{t(`history.kind.${job.kind}`)}</TableCell>
        <TableCell>
          <Chip tone={jobTone(job.status)} label={t(`history.jobStatus.${job.status}`)} />
        </TableCell>
        <TableCell>{fmt(job.startedAt ?? job.createdAt)}</TableCell>
        <TableCell>{fmt(job.finishedAt)}</TableCell>
        <TableCell className="font-mono text-xs">
          {job.restore ? job.restore.snapshotId : '—'}
        </TableCell>
        <TableCell className="text-end">
          {hasDetails && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={open}
              onClick={onToggle}
            >
              {open ? (
                <ChevronUp className="size-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="size-4" aria-hidden="true" />
              )}
              {open ? t('history.hideLogs') : t('history.showLogs')}
            </Button>
          )}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow data-testid={`history-logs-${job.id}`}>
          <TableCell colSpan={6}>
            <pre className="bg-muted/40 max-h-64 w-full overflow-auto rounded-md border p-2 font-mono text-xs whitespace-pre-wrap" dir="ltr">
              {[...(job.error ? [job.error] : []), ...job.logTail].join('\n')}
            </pre>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};
