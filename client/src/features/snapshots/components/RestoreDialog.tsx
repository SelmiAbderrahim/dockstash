import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@shared/hooks/redux';
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
 * Typed-confirm restore dialog. The Restore button is disabled until the
 * user types the exact project name. Overwrite mode defaults to OFF; the
 * user must opt in explicitly.
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
  const previouslyFocused = useRef<Element | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();
  const modeId = useId();

  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement;
      setTyped('');
      setOverwrite(false);
      setTargetPath('');
      queueMicrotask(() => firstFieldRef.current?.focus());
    } else if (previouslyFocused.current instanceof HTMLElement) {
      previouslyFocused.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

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
    onClose();
  };

  return (
    <div className="ds-dialog__backdrop" role="presentation" onClick={onClose}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${inputId}-title`}
        aria-describedby={`${inputId}-desc`}
        className="ds-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={`${inputId}-title`}>{t('restore.title')}</h2>
        <p id={`${inputId}-desc`}>{t('restore.description', { projectName })}</p>

        <fieldset className="ds-dialog__mode" aria-labelledby={modeId}>
          <legend id={modeId}>{t('restore.mode')}</legend>
          <label className="ds-radio">
            <input
              type="radio"
              name="restore-mode"
              checked={!overwrite}
              onChange={() => setOverwrite(false)}
            />
            <span>{t('restore.newLocation')}</span>
          </label>
          {!overwrite && (
            <label className="ds-field">
              <span>{t('restore.targetPath')}</span>
              <input
                type="text"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                placeholder="/var/restores/…"
                aria-required="true"
              />
            </label>
          )}
          <label className="ds-radio">
            <input
              type="radio"
              name="restore-mode"
              checked={overwrite}
              onChange={() => setOverwrite(true)}
            />
            <span>{t('restore.overwrite')}</span>
          </label>
        </fieldset>

        <label className="ds-field">
          <span>{t('restore.typeToConfirm', { projectName })}</span>
          <input
            ref={firstFieldRef}
            id={inputId}
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-required="true"
            autoComplete="off"
          />
        </label>

        <div className="ds-dialog__actions">
          <button type="button" className="ds-btn ds-btn--ghost" onClick={onClose}>
            {t('restore.cancel')}
          </button>
          <button
            type="button"
            className="ds-btn ds-btn--danger"
            disabled={!enabled}
            onClick={onConfirm}
            data-testid="restore-confirm"
          >
            {t('restore.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
