import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { CircleCheck } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { useIsMobile } from '@shared/hooks/use-mobile';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Label } from '@shared/ui/label';
import { Switch } from '@shared/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@shared/ui/sheet';
import { loadProgress } from '../lib/progressStorage';
import { sortToursForRoute } from '../tours';
import type { TourDefinition, TourStep } from '../types';
import {
  selectGuideEnabled,
  selectGuideError,
  selectGuidePanelOpen,
  selectGuideSaving,
} from '../store/selectors';
import { closePanel, startTour } from '../store/slice';
import { setGuideMe } from '../store/thunks';

export const GuidePanel = () => {
  const { t } = useTranslation('guide');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const open = useAppSelector(selectGuidePanelOpen);
  const enabled = useAppSelector(selectGuideEnabled);
  const saving = useAppSelector(selectGuideSaving);
  const error = useAppSelector(selectGuideError);

  // Re-read persisted progress each time the panel opens.
  const [progress, setProgress] = useState(loadProgress);
  useEffect(() => {
    if (open) setProgress(loadProgress());
  }, [open]);
  const tours = useMemo(
    () => sortToursForRoute(location.pathname, progress.completed),
    [location.pathname, progress],
  );

  const resumeFor = (tour: TourDefinition) =>
    progress.resume && progress.resume.tourId === tour.id ? progress.resume : null;

  const start = (tour: TourDefinition): void => {
    const resume = resumeFor(tour);
    const stepIndex = resume ? Math.min(resume.stepIndex, tour.steps.length - 1) : 0;
    dispatch(startTour({ tourId: tour.id, stepIndex }));
    // stepIndex is clamped above, so the step always exists.
    const route = (tour.steps[stepIndex] as TourStep).route;
    if (route) navigate(route);
  };

  const rtl = typeof document !== 'undefined' && document.dir === 'rtl';
  const side = isMobile ? 'bottom' : rtl ? 'left' : 'right';

  return (
    // Without a SheetTrigger the only open-state changes Radix reports are closes.
    <Sheet open={open} onOpenChange={() => dispatch(closePanel())}>
      <SheetContent side={side} className="max-h-dvh overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('panel.title')}</SheetTitle>
          <SheetDescription>
            {t('panel.progress', {
              done: progress.completed.length,
              total: tours.length,
            })}
          </SheetDescription>
        </SheetHeader>
        <ul className="flex flex-col gap-3 px-4">
          {tours.map((tour) => {
            const completed = progress.completed.includes(tour.id);
            const here = location.pathname.startsWith(tour.routePrefix);
            const resume = resumeFor(tour);
            return (
              <li key={tour.id} className="rounded-lg border bg-card p-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{t(tour.titleKey)}</span>
                  {completed ? (
                    <CircleCheck
                      className="size-4 text-success"
                      aria-label={t('panel.completed')}
                    />
                  ) : null}
                  {here ? <Badge variant="outline">{t('panel.youAreHere')}</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{t(tour.descriptionKey)}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => start(tour)}
                >
                  {resume
                    ? t('panel.resume', { step: resume.stepIndex + 1 })
                    : completed
                      ? t('panel.replay')
                      : t('panel.start')}
                </Button>
              </li>
            );
          })}
        </ul>
        <SheetFooter>
          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <Label htmlFor="guide-me-panel-switch" className="text-sm">
              {t('toggle.label')}
            </Label>
            <Switch
              id="guide-me-panel-switch"
              checked={enabled}
              disabled={saving}
              onCheckedChange={(checked) => {
                void dispatch(setGuideMe(checked));
              }}
            />
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
