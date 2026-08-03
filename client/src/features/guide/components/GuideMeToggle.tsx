import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { Label } from '@shared/ui/label';
import { Switch } from '@shared/ui/switch';
import { selectGuideEnabled, selectGuideError, selectGuideSaving } from '../store/selectors';
import { setGuideMe } from '../store/thunks';

/** Settings-screen switch — the way back once the floating launcher is hidden. */
export const GuideMeToggle = () => {
  const { t } = useTranslation('guide');
  const dispatch = useAppDispatch();
  const enabled = useAppSelector(selectGuideEnabled);
  const saving = useAppSelector(selectGuideSaving);
  const error = useAppSelector(selectGuideError);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 shadow-xs">
      <div>
        <Label htmlFor="guide-me-toggle" className="text-sm font-medium">
          {t('toggle.label')}
        </Label>
        <p className="mt-1 text-sm text-muted-foreground">{t('toggle.description')}</p>
        {error ? (
          <p role="alert" className="mt-1 text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <Switch
        id="guide-me-toggle"
        checked={enabled}
        disabled={saving}
        onCheckedChange={(checked) => {
          void dispatch(setGuideMe(checked));
        }}
      />
    </div>
  );
};
