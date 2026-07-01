import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { subscribeToJobLogs, type LogStreamHandle } from '@shared/socket/logStream';

interface ResticLogPanelProps {
  jobId: string | null;
  title?: string;
  onDone?: (ok: boolean, detail?: string) => void;
}

/**
 * Streams restic output from `/scheduler` socket namespace into a scrolling
 * `<pre role="log" aria-live="polite">`. Renders a spinner+text while the
 * run is active. No pulse, no bounce, no `transition: all`.
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
    <section className="log-panel" aria-labelledby="log-panel-title">
      <header className="log-panel__header">
        <h3 id="log-panel-title">{title ?? t('logPanel.title', { defaultValue: 'Backup output' })}</h3>
        <span className="log-panel__status" data-status={status}>
          {status === 'running' && (
            <span role="status" aria-live="polite">
              <span className="log-panel__spinner" aria-hidden="true" />
              {t('logPanel.running', { defaultValue: 'Running…' })}
            </span>
          )}
          {status === 'done' && t('logPanel.done', { defaultValue: 'Completed' })}
          {status === 'failed' && t('logPanel.failed', { defaultValue: 'Failed' })}
        </span>
      </header>
      {error && (
        <p role="alert" className="log-panel__error">
          {error}
        </p>
      )}
      <pre
        ref={preRef}
        role="log"
        aria-live="polite"
        aria-atomic="false"
        className="log-panel__stream"
        data-testid="restic-log-stream"
      >
        {lines.join('\n')}
      </pre>
    </section>
  );
};
