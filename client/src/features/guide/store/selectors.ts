import type { GuideState, TourDefinition, TourStep } from '../types';
import { findTour } from '../tours';

interface RootStateWithGuide {
  guide: GuideState;
}

export const selectGuideEnabled = (state: RootStateWithGuide): boolean => state.guide.enabled;
export const selectGuideSaving = (state: RootStateWithGuide): boolean => state.guide.saving;
export const selectGuideError = (state: RootStateWithGuide): string | null => state.guide.error;
export const selectGuidePanelOpen = (state: RootStateWithGuide): boolean => state.guide.panelOpen;
export const selectStepIndex = (state: RootStateWithGuide): number => state.guide.stepIndex;
export const selectActiveTour = (state: RootStateWithGuide): TourDefinition | null =>
  findTour(state.guide.activeTourId);

/** `data-tour` target of the active step, or null when no tour is running. */
export const selectActiveStepTarget = (state: RootStateWithGuide): string | null => {
  const tour = findTour(state.guide.activeTourId);
  if (!tour) return null;
  // Index is clamped to the registry the same way TourOverlay's stepAt does it,
  // so the lookup is always in range — safe under noUncheckedIndexedAccess.
  const i = Math.min(state.guide.stepIndex, tour.steps.length - 1);
  return (tour.steps[i] as TourStep).target;
};
