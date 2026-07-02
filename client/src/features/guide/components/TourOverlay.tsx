import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { Button } from '@shared/ui/button';
import { useAnchor } from '../hooks/useAnchor';
import {
  computeArrowPosition,
  computeSpotlightRect,
  computeTooltipPosition,
  resolvePlacement,
  type Size,
} from '../lib/positioning';
import { clearResume, markCompleted, saveResume } from '../lib/progressStorage';
import { selectActiveTour, selectStepIndex } from '../store/selectors';
import { endTour, nextStep, prevStep } from '../store/slice';
import type { TourDefinition, TourStep } from '../types';

const FALLBACK_TOOLTIP_SIZE: Size = { width: 320, height: 168 };

const focusLauncher = (): void => {
  document.querySelector<HTMLElement>('[data-guide-launcher]')?.focus();
};

const findTarget = (target: string): Element | null =>
  document.querySelector(`[data-tour="${target}"]`);

// Tour registries are static and non-empty, and the index is clamped by the
// caller — safe under noUncheckedIndexedAccess.
const stepAt = (tour: TourDefinition, index: number): TourStep =>
  tour.steps[Math.min(index, tour.steps.length - 1)] as TourStep;

const ActiveTour = ({ tour }: { tour: TourDefinition }) => {
  const { t } = useTranslation('guide');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const rawIndex = useAppSelector(selectStepIndex);
  const index = Math.min(rawIndex, tour.steps.length - 1);
  const step = stepAt(tour, index);
  const isLast = index === tour.steps.length - 1;
  const rtl = document.dir === 'rtl';

  const anchor = useAnchor(step.target, true);
  const cardRef = useRef<HTMLDivElement>(null);
  // Set while the tour is closing so the focus trap does not steal focus
  // back from the launcher during the same event dispatch.
  const closingRef = useRef(false);
  const [tooltipSize, setTooltipSize] = useState<Size>(FALLBACK_TOOLTIP_SIZE);

  const currentUrl = `${location.pathname}${location.search}`;

  // One navigation per step — the missing-state "take me there" button covers retries.
  useEffect(() => {
    if (step.route && currentUrl !== step.route) {
      navigate(step.route);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour.id, index]);

  const finish = useCallback((): void => {
    closingRef.current = true;
    markCompleted(tour.id);
    dispatch(endTour());
    focusLauncher();
  }, [dispatch, tour.id]);

  const forward = useCallback((): void => {
    if (isLast) finish();
    else dispatch(nextStep());
  }, [dispatch, finish, isLast]);

  const back = useCallback((): void => {
    if (index > 0) dispatch(prevStep());
  }, [dispatch, index]);

  /** Pause: keep the place so the panel can offer "resume from step n". */
  const quit = useCallback((): void => {
    closingRef.current = true;
    saveResume({ tourId: tour.id, stepIndex: index });
    dispatch(endTour());
    focusLauncher();
  }, [dispatch, index, tour.id]);

  /** Abandon: drop the bookmark entirely. */
  const skipTour = useCallback((): void => {
    closingRef.current = true;
    clearResume();
    dispatch(endTour());
    focusLauncher();
  }, [dispatch]);

  // Learn-by-doing: advance once the user performs the step's action on the
  // real element ('change' rather than 'input' so typing is not interrupted).
  useEffect(() => {
    if (anchor.status !== 'found' || !step.advanceOn) return;
    const el = findTarget(step.target);
    if (!el) return;
    const eventName = step.advanceOn === 'input' ? 'change' : 'click';
    const handler = (): void => forward();
    el.addEventListener(eventName, handler, { once: true });
    return () => el.removeEventListener(eventName, handler);
  }, [anchor.status, forward, step.advanceOn, step.target]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        quit();
        return;
      }
      if (event.key === 'ArrowRight') (rtl ? back : forward)();
      if (event.key === 'ArrowLeft') (rtl ? forward : back)();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [back, forward, quit, rtl]);

  // The card renders in every overlay state, so the ref is always attached
  // while these document-level effects are live.
  const card = (): HTMLDivElement => cardRef.current as HTMLDivElement;

  // Soft focus trap: keep focus inside the card or the highlighted element.
  useEffect(() => {
    const onFocusIn = (event: FocusEvent): void => {
      if (closingRef.current) return;
      const focused = event.target as Node;
      const targetEl = findTarget(step.target);
      if (card().contains(focused) || (targetEl && targetEl.contains(focused))) return;
      card().focus();
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, [step.target]);

  // Move focus to the card on step change unless the user is in the target.
  useEffect(() => {
    const targetEl = findTarget(step.target);
    if (targetEl && targetEl.contains(document.activeElement)) return;
    card().focus();
  }, [index, anchor.status, step.target]);

  useLayoutEffect(() => {
    const width = card().offsetWidth;
    const height = card().offsetHeight;
    if (!width || !height) return;
    setTooltipSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  }, [index, anchor.rect]);

  const viewport: Size = { width: window.innerWidth, height: window.innerHeight };

  const counter = t('overlay.counter', { current: index + 1, total: tour.steps.length });

  const dots = (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {tour.steps.map((s, i) => (
        <span
          key={s.target + String(i)}
          className={`size-1.5 rounded-full ${i === index ? 'bg-foreground' : 'bg-muted-foreground/40'}`}
        />
      ))}
    </div>
  );

  const header = (
    <div className="flex items-start justify-between gap-3">
      <p className="text-xs font-medium text-muted-foreground">{counter}</p>
      <button
        type="button"
        aria-label={t('overlay.close')}
        onClick={quit}
        className="rounded-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );

  const rect = anchor.status === 'found' ? anchor.rect : null;
  if (!rect) {
    return createPortal(
      <div className="fixed inset-0 z-[60] bg-black/50">
        <div
          ref={cardRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={t(tour.titleKey)}
          className="fixed start-1/2 top-1/2 w-80 max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-4 shadow-xs rtl:translate-x-1/2"
        >
          {header}
          {anchor.status === 'searching' ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t('overlay.searching')}
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-foreground">{t('overlay.missing')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {step.route ? (
                  <Button type="button" size="sm" onClick={() => navigate(step.route as string)}>
                    {t('overlay.takeMeThere')}
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" onClick={forward}>
                  {isLast ? t('overlay.done') : t('overlay.skipStep')}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={skipTour}>
                  {t('overlay.endTour')}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>,
      document.body,
    );
  }

  const spotlight = computeSpotlightRect(rect);
  const placement = resolvePlacement(step.placement, rtl, rect, tooltipSize, viewport);
  const tooltipPos = computeTooltipPosition(rect, tooltipSize, placement, viewport);
  const arrowPos = computeArrowPosition(rect, tooltipPos, tooltipSize, placement);

  const spotlightBottom = spotlight.top + spotlight.height;
  const spotlightEnd = spotlight.left + spotlight.width;
  const dim = 'fixed z-[60] bg-black/50';

  const next = stepAt(tour, index + 1);
  const nextGoesElsewhere = !isLast && !!next.route && next.route !== step.route;
  const nextLabel = isLast
    ? t('overlay.done')
    : nextGoesElsewhere
      ? t('overlay.takeMeThere')
      : t('overlay.next');

  return createPortal(
    <>
      {/* 4-rect dim keeps the highlighted element fully interactive. */}
      <div className={dim} style={{ top: 0, left: 0, width: viewport.width, height: Math.max(0, spotlight.top) }} />
      <div className={dim} style={{ top: spotlightBottom, left: 0, width: viewport.width, height: Math.max(0, viewport.height - spotlightBottom) }} />
      <div className={dim} style={{ top: spotlight.top, left: 0, width: Math.max(0, spotlight.left), height: spotlight.height }} />
      <div className={dim} style={{ top: spotlight.top, left: spotlightEnd, width: Math.max(0, viewport.width - spotlightEnd), height: spotlight.height }} />
      <div
        className="pointer-events-none fixed z-[60] rounded-md border-2 border-ring"
        style={{
          top: spotlight.top,
          left: spotlight.left,
          width: spotlight.width,
          height: spotlight.height,
        }}
        data-testid="guide-spotlight"
      />
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t(step.titleKey)}
        className="fixed z-[61] w-80 max-w-[calc(100vw-2rem)] rounded-lg border bg-background p-4 shadow-xs"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
      >
        <span
          aria-hidden="true"
          className="absolute size-2 rotate-45 border bg-background"
          style={{ top: arrowPos.top, left: arrowPos.left }}
        />
        {header}
        <h2 className="mt-1 text-sm font-semibold text-foreground">{t(step.titleKey)}</h2>
        <p aria-live="polite" className="mt-1 text-sm text-muted-foreground">
          {t(step.bodyKey)}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          {dots}
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={skipTour}>
              {t('overlay.skipTour')}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={back}>
              {t('overlay.back')}
            </Button>
            <Button type="button" size="sm" onClick={forward}>
              {nextLabel}
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
};

export const TourOverlay = () => {
  const tour = useAppSelector(selectActiveTour);
  if (!tour) return null;
  return <ActiveTour tour={tour} />;
};
