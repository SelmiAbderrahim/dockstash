import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { Button } from '@shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { registerAgent } from '../store/thunks';
import type { FleetRejection } from '../store/thunks';
import { resetRegisterState } from '../store/slice';
import { selectRegisterError, selectRegisterStatus } from '../store/selectors';
import { DEFAULT_PROJECT_ROOT, parseProjectRootsInput } from '../install-command';
import { AgentKeyReveal } from './AgentKeyReveal';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Register-agent dialog. On success it swaps the form for the one-time API
 * key: the key is never retrievable again, so it stays component-local and is
 * discarded as soon as the dialog closes.
 */
export const RegisterAgentDialog = ({ open, onClose }: Props) => {
  const { t } = useTranslation('common');
  const dispatch = useAppDispatch();
  const registerStatus = useAppSelector(selectRegisterStatus);
  const registerError = useAppSelector(selectRegisterError);

  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  // Directories the agent may discover/back up — baked into the install
  // command as mounts + DOCKSTASH_PROJECT_ROOTS (never sent to the API; the
  // server learns the real roots from the agent's heartbeat).
  const [rootsInput, setRootsInput] = useState(DEFAULT_PROJECT_ROOT);
  const [token, setToken] = useState<string | null>(null);
  // Set from a 409 (duplicate host) so the error lands on the offending field
  // rather than the generic form alert. Cleared as soon as the host is edited.
  const [hostError, setHostError] = useState<string | null>(null);

  const parsedRoots = parseProjectRootsInput(rootsInput);
  const rootsInvalid = parsedRoots.invalid.length > 0 || parsedRoots.roots.length === 0;
  const canSubmit = name.trim().length > 0 && host.trim().length > 0 && !rootsInvalid;
  const saving = registerStatus === 'loading';

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setName('');
      setHost('');
      setPort('');
      setRootsInput(DEFAULT_PROJECT_ROOT);
      setToken(null);
      setHostError(null);
      dispatch(resetRegisterState());
      onClose();
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit || saving) return;
    setHostError(null);
    void dispatch(
      registerAgent({
        name: name.trim(),
        host: host.trim(),
        ...(port ? { port: Number(port) } : {}),
      }),
    )
      .unwrap()
      .then((result) => setToken(result.token))
      .catch((rejection: FleetRejection | undefined) => {
        // A duplicate host (409) belongs on the field; other errors fall through
        // to the generic alert via selectRegisterError.
        if (rejection?.conflict) setHostError(rejection.message);
      });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={`flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 ${token ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
      >
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>{t('fleet.dialog.title')}</DialogTitle>
          <DialogDescription>{t('fleet.dialog.description')}</DialogDescription>
        </DialogHeader>

        {token ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-6 pb-2">
              <AgentKeyReveal token={token} roots={parsedRoots.roots} />
            </div>
            <DialogFooter className="border-t p-6 pt-4">
              <Button type="button" onClick={() => handleOpenChange(false)}>
                {t('fleet.dialog.done')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form className="flex min-h-0 flex-1 flex-col text-start" onSubmit={onSubmit}>
            <div className="flex flex-col gap-4 overflow-y-auto px-6 pb-2 pt-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="agent-name">{t('fleet.dialog.name')}</Label>
              <Input
                id="agent-name"
                data-tour="agent-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="agent-host">{t('fleet.dialog.host')}</Label>
                <Input
                  id="agent-host"
                  data-tour="agent-host-input"
                  type="text"
                  value={host}
                  onChange={(e) => {
                    setHost(e.target.value);
                    if (hostError) setHostError(null);
                  }}
                  required
                  autoComplete="off"
                  aria-invalid={hostError ? true : undefined}
                  aria-describedby={hostError ? 'agent-host-error' : undefined}
                />
                {hostError ? (
                  <span
                    id="agent-host-error"
                    role="alert"
                    className="text-sm font-medium text-destructive"
                  >
                    {hostError}
                  </span>
                ) : (
                  <small className="text-sm text-muted-foreground">{t('fleet.dialog.hostHint')}</small>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="agent-port">{t('fleet.dialog.port')}</Label>
                <Input
                  id="agent-port"
                  data-tour="agent-port-input"
                  type="number"
                  min={1}
                  max={65535}
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                />
                <small className="text-sm text-muted-foreground">{t('fleet.dialog.portHint')}</small>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="agent-roots">{t('fleet.dialog.roots')}</Label>
              <Input
                id="agent-roots"
                data-tour="agent-roots-input"
                type="text"
                value={rootsInput}
                onChange={(e) => setRootsInput(e.target.value)}
                autoComplete="off"
                aria-invalid={rootsInvalid ? true : undefined}
                aria-describedby={rootsInvalid ? 'agent-roots-error' : 'agent-roots-hint'}
              />
              {rootsInvalid ? (
                <span
                  id="agent-roots-error"
                  role="alert"
                  className="text-sm font-medium text-destructive"
                >
                  {parsedRoots.invalid.length > 0
                    ? t('fleet.dialog.rootsInvalid', {
                        entries: parsedRoots.invalid.join(', '),
                      })
                    : t('fleet.dialog.rootsEmpty')}
                </span>
              ) : (
                <small id="agent-roots-hint" className="text-sm text-muted-foreground">
                  {t('fleet.dialog.rootsHint')}
                </small>
              )}
            </div>
            {registerStatus === 'failed' && !hostError && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {registerError ?? t('fleet.errors.register')}
              </span>
            )}
            </div>
            <DialogFooter className="border-t p-6 pt-4">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                {t('fleet.dialog.cancel')}
              </Button>
              <Button
                type="submit"
                data-tour="agent-register-submit"
                disabled={!canSubmit}
                loading={saving}
              >
                {t('fleet.dialog.submit')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
