import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { useCopyToClipboard } from '@shared/hooks/useCopyToClipboard';
import { Button } from '@shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog';
import { buildAgentUpdateCommand } from '../install-command';
import type { FleetEntry } from '../types';

interface Props {
  agent: FleetEntry | null;
  onClose: () => void;
}

/**
 * Row-action dialog showing the copy-paste command to update an already-running
 * agent (pull the latest image + recreate). Static — no token or roots — since
 * the host's compose file already carries them.
 */
export const AgentUpdateDialog = ({ agent, onClose }: Props) => {
  const { t } = useTranslation('common');
  const { copied, copy } = useCopyToClipboard();
  const command = buildAgentUpdateCommand();

  const handleOpenChange = (next: boolean) => {
    if (!next) onClose();
  };

  return (
    <Dialog open={agent !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>{t('fleet.update.title')}</DialogTitle>
          <DialogDescription>{t('fleet.update.description')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-6 pb-2 text-start">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t('fleet.update.intro')}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void copy(command)}>
              {copied ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <Copy className="size-4" aria-hidden="true" />
              )}
              {copied ? t('fleet.install.copied') : t('fleet.install.copy')}
            </Button>
          </div>
          <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3">
            <code className="font-mono text-xs">{command}</code>
          </pre>
        </div>

        <DialogFooter className="border-t p-6 pt-4">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {t('fleet.update.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
