import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { useCopyToClipboard } from '@shared/hooks/useCopyToClipboard';
import { Button } from '@shared/ui/button';
import { buildAgentInstallCommand, resolveAgentServerUrl } from '../install-command';

interface Props {
  /** Real token bakes it into the command; omit for the `<AGENT_TOKEN>` placeholder. */
  token?: string;
  /** Project directories to mount + allowlist; omit for the /var/www default. */
  roots?: string[];
}

/**
 * The copyable `docker compose` one-paste that connects a VPS to the fleet.
 * Uses `useCopyToClipboard` (insecure-context safe) — never the raw clipboard
 * API, since fleet dashboards are reached over bare http.
 */
export const AgentInstallCommand = ({ token, roots }: Props) => {
  const { t } = useTranslation('common');
  const { copied, copy } = useCopyToClipboard();
  const command = buildAgentInstallCommand({
    token,
    serverUrl: resolveAgentServerUrl(),
    roots,
  });

  return (
    <div className="flex flex-col gap-2 text-start" data-tour="agent-install-command">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">{t('fleet.dialog.installTitle')}</h3>
        <Button type="button" variant="outline" size="sm" onClick={() => void copy(command)}>
          {copied ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
          {copied ? t('fleet.install.copied') : t('fleet.install.copy')}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t('fleet.dialog.installIntro')}</p>
      <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3">
        <code className="font-mono text-xs">{command}</code>
      </pre>
    </div>
  );
};
