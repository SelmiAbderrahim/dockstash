import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { subscribeToJobLogs, type LogStreamHandle } from '@shared/socket/logStream';
import { cn } from '@shared/lib/utils';
import { Badge } from '@shared/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@shared/ui/card';

const STATUS_VARIANT: Record<
  'idle' | 'running' | 'done' | 'failed',
  'secondary' | 'default' | 'destructive'
> = {
  idle: 'secondary',
  running: 'secondary',
  done: 'default',
  failed: 'destructive',
};

interface ResticLogPanelProps {
  jobId: string | null;
  title?: string;
  onDone?: (ok: boolean, detail?: string) => void;
}

/**
 * Streams restic output from `/scheduler` socket namespace into a scrolling
 * `<pre role="log" aria-live="polite">`. Renders a spinner+text while the
 * run is active. Motion respects the anti-Codex constraints (no pulse,
 * no bounce, scoped color-only transitions only).
 */
export const ResticLogPanel = ({ jobId, title, onDone }: ResticLogPanelProps) => {
  const { t } = useTranslation('common');
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    if (!jobId) {
      setStatus('idle');
      setLines([]);
      setError(null);
      return;
    }
    setStatus('running');
    setLines([]);
    setError(null);

    const handle: LogStreamHandle = subscribeToJobLogs(jobId, {
      onLog: ({ line }) => setLines((prev) => [...prev, line]),
      onDone: ({ ok, detail }) => {
        setStatus(ok ? 'done' : 'failed');
        onDone?.(ok, detail);
      },
      onError: (msg) => setError(msg),
    });

    return () => handle.disconnect();
  }, [jobId, onDone]);

  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [lines.length]);

  if (!jobId) return null;

  return (
    <Card className="log-panel gap-0 py-0" aria-labelledby="log-panel-title">
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b py-3">
        <CardTitle id="log-panel-title" className="text-sm font-medium">
          {title ?? t('logPanel.title', { defaultValue: 'Backup output' })}
        </CardTitle>
        <Badge variant={STATUS_VARIANT[status]} data-status={status}>
          {status === 'running' && (
            <span role="status" aria-live="polite" className="inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              {t('logPanel.running', { defaultValue: 'Running…' })}
            </span>
          )}
          {status === 'done' && t('logPanel.done', { defaultValue: 'Completed' })}
          {status === 'failed' && t('logPanel.failed', { defaultValue: 'Failed' })}
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        {error && (
          <p
            role="alert"
            className="text-destructive border-b px-4 py-2 text-sm"
          >
            {error}
          </p>
        )}
        <pre
          ref={preRef}
          role="log"
          aria-live="polite"
          aria-atomic="false"
          data-testid="restic-log-stream"
          className={cn(
            'bg-muted/40 text-foreground m-0 max-h-96 overflow-auto rounded-b-xl p-4',
            'font-mono text-xs leading-relaxed whitespace-pre-wrap',
          )}
        >
          {lines.join('\n')}
        </pre>
      </CardContent>
    </Card>
  );
};
