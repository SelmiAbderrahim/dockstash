import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@shared/ui/alert-dialog';
import { Button } from '@shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog';
import { rotateAgentKey } from '../store/thunks';
import { resetRotateState } from '../store/slice';
import { selectRotateError, selectRotateStatus } from '../store/selectors';
import { AgentInstallCommand } from './AgentInstallCommand';
import { AgentKeyReveal } from './AgentKeyReveal';
import type { FleetEntry } from '../types';

interface Props {
  agent: FleetEntry | null;
  onClose: () => void;
}

/**
 * Row-action dialog: shows the install command with a `<AGENT_TOKEN>`
 * placeholder (the real key is unrecoverable), plus a rotate action that mints
 * a fresh token and swaps to the one-time reveal.
 */
export const AgentSetupDialog = ({ agent, onClose }: Props) => {
  const { t } = useTranslation('common');
  const dispatch = useAppDispatch();
  const rotateStatus = useAppSelector(selectRotateStatus);
  const rotateError = useAppSelector(selectRotateError);
  const [token, setToken] = useState<string | null>(null);

  const rotating = rotateStatus === 'loading';

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setToken(null);
      dispatch(resetRotateState());
      onClose();
    }
  };

  const onRotate = () => {
    // Defensive only: the rotate trigger lives inside the `agent !== null`
    // branch of the Dialog below, so `agent` is always set when this runs.
    /* v8 ignore next */
    if (!agent) return;
    void dispatch(rotateAgentKey(agent.id))
      .unwrap()
      .then((result) => setToken(result.token))
      .catch(() => {
        /* surfaced via selectRotateError */
      });
  };

  return (
    <Dialog open={agent !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>{t('fleet.setup.title')}</DialogTitle>
          <DialogDescription>{t('fleet.setup.description')}</DialogDescription>
        </DialogHeader>

        {token ? (
          <div className="flex-1 overflow-y-auto px-6 pb-2">
            <AgentKeyReveal token={token} />
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pb-2 text-start">
            <AgentInstallCommand />
            <p className="text-sm text-muted-foreground">{t('fleet.setup.keyPlaceholderNote')}</p>
            {rotateStatus === 'failed' && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {rotateError ?? t('fleet.errors.rotate')}
              </span>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" disabled={rotating}>
                  {rotating ? t('fleet.rotate.rotating') : t('fleet.rotate.title')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('fleet.rotate.title')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('fleet.rotate.description')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('fleet.rotate.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={onRotate}>{t('fleet.rotate.confirm')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        <DialogFooter className="border-t p-6 pt-4">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {t('fleet.setup.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
