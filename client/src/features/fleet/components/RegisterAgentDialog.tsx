import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { Alert, AlertDescription } from '@shared/ui/alert';
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
import { resetRegisterState } from '../store/slice';
import { selectRegisterError, selectRegisterStatus } from '../store/selectors';

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
  const [apiKey, setApiKey] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && host.trim().length > 0;
  const saving = registerStatus === 'loading';

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setName('');
      setHost('');
      setPort('');
      setApiKey(null);
      dispatch(resetRegisterState());
      onClose();
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit || saving) return;
    void dispatch(
      registerAgent({
        name: name.trim(),
        host: host.trim(),
        ...(port ? { port: Number(port) } : {}),
      }),
    )
      .unwrap()
      .then((result) => setApiKey(result.apiKey))
      .catch(() => {
        /* surfaced via selectRegisterError */
      });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('fleet.dialog.title')}</DialogTitle>
          <DialogDescription>{t('fleet.dialog.description')}</DialogDescription>
        </DialogHeader>

        {apiKey ? (
          <div className="flex flex-col gap-4 text-start" data-testid="agent-api-key">
            <Alert variant="destructive">
              <AlertDescription>{t('fleet.dialog.keyWarning')}</AlertDescription>
            </Alert>
            <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 p-3">
              <code className="font-mono text-sm break-all">{apiKey}</code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void navigator.clipboard?.writeText(apiKey)}
              >
                <Copy className="size-4" aria-hidden="true" />
                {t('fleet.dialog.copy')}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                {t('fleet.dialog.done')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form className="flex flex-col gap-4 text-start" onSubmit={onSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="agent-name">{t('fleet.dialog.name')}</Label>
              <Input
                id="agent-name"
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
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="agent-port">{t('fleet.dialog.port')}</Label>
                <Input
                  id="agent-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                />
              </div>
            </div>
            {registerStatus === 'failed' && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {registerError ?? t('fleet.errors.register')}
              </span>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                {t('fleet.dialog.cancel')}
              </Button>
              <Button type="submit" disabled={!canSubmit || saving}>
                {saving ? t('fleet.dialog.submitting') : t('fleet.dialog.submit')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
