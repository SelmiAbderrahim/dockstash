import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { useCopyToClipboard } from '@shared/hooks/useCopyToClipboard';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Button } from '@shared/ui/button';
import { AgentInstallCommand } from './AgentInstallCommand';

interface Props {
  token: string;
  /** Project directories chosen at registration; forwarded into the command. */
  roots?: string[];
}

/**
 * The one-time token reveal — a destructive "copy it now" warning, the token
 * with a copy button, and the install command with the token baked in. Shared
 * by the register dialog and the rotate-key flow; the token stays
 * component-local and is discarded when the dialog closes.
 */
export const AgentKeyReveal = ({ token, roots }: Props) => {
  const { t } = useTranslation('common');
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className="flex flex-col gap-4 text-start" data-testid="agent-api-key">
      <Alert variant="destructive">
        <AlertDescription>{t('fleet.dialog.keyWarning')}</AlertDescription>
      </Alert>
      <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 p-3">
        <code className="font-mono text-sm break-all">{token}</code>
        <Button type="button" variant="outline" size="sm" onClick={() => void copy(token)}>
          {copied ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
          {copied ? t('fleet.dialog.copied') : t('fleet.dialog.copy')}
        </Button>
      </div>
      <AgentInstallCommand token={token} roots={roots} />
    </div>
  );
};
