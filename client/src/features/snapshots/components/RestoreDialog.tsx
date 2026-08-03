import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@shared/hooks/redux';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@shared/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { restore } from '../store/thunks';
import type { Snapshot } from '../types';

interface Props {
  snapshot: Snapshot;
  projectId: string;
  projectName: string;
  open: boolean;
  onClose: () => void;
  onConfirmed?: () => void;
}

/**
 * Typed-confirm restore dialog built on the shadcn <AlertDialog>. The Restore
 * button stays disabled until the user types the exact project name. Overwrite
 * mode defaults to OFF; the user must opt in explicitly. Escape / Cancel /
 * overlay dismissal all flow through Radix `onOpenChange`.
 */
export const RestoreDialog = ({
  snapshot,
  projectId,
  projectName,
  open,
  onClose,
  onConfirmed,
}: Props) => {
  const { t } = useTranslation('snapshots');
  const dispatch = useAppDispatch();
  const [typed, setTyped] = useState('');
  const [overwrite, setOverwrite] = useState(false);
  const [targetPath, setTargetPath] = useState('');
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const baseId = useId();
  const typeId = `${baseId}-type`;
  const pathId = `${baseId}-path`;
  const newId = `${baseId}-new`;
  const overwriteId = `${baseId}-overwrite`;

  const enabled = typed === projectName && (overwrite || targetPath.length > 0);

  const onConfirm = () => {
    void dispatch(
      restore({
        projectId,
        snapshotId: snapshot.id,
        overwrite,
        targetPath: overwrite ? undefined : targetPath,
      }),
    );
    onConfirmed?.();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) onClose();
  };

  // Radix restores focus to its own <AlertDialogTrigger>; this dialog is opened
  // externally (no trigger), so capture the invoking element on open and return
  // focus to it on close ourselves.
  const handleOpenAutoFocus = () => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
  };

  const handleCloseAutoFocus = (event: Event) => {
    event.preventDefault();
    previouslyFocused.current!.focus();
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        onOpenAutoFocus={handleOpenAutoFocus}
        onCloseAutoFocus={handleCloseAutoFocus}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t('restore.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('restore.description', { projectName })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-4 text-start">
          <RadioGroup
            value={overwrite ? 'overwrite' : 'new'}
            onValueChange={(v) => setOverwrite(v === 'overwrite')}
            aria-label={t('restore.mode')}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="new" id={newId} />
              <Label htmlFor={newId} className="font-normal">
                {t('restore.newLocation')}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="overwrite" id={overwriteId} />
              <Label htmlFor={overwriteId} className="font-normal">
                {t('restore.overwrite')}
              </Label>
            </div>
          </RadioGroup>

          {!overwrite && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={pathId}>{t('restore.targetPath')}</Label>
              <Input
                id={pathId}
                type="text"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                placeholder="/var/restores/…"
                aria-required="true"
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor={typeId}>{t('restore.typeToConfirm', { projectName })}</Label>
            <Input
              id={typeId}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-required="true"
              autoComplete="off"
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t('restore.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!enabled}
            onClick={onConfirm}
            data-testid="restore-confirm"
          >
            {t('restore.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
