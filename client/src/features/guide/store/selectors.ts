import type { GuideState, TourDefinition } from '../types';
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
