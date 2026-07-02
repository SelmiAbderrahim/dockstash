import { describe, expect, it } from 'vitest';
import type { GuideState } from '../types';
import {
  selectActiveStepTarget,
  selectActiveTour,
  selectGuideEnabled,
  selectGuideError,
  selectGuidePanelOpen,
  selectGuideSaving,
  selectStepIndex,
} from './selectors';

const state = (over: Partial<GuideState> = {}): { guide: GuideState } => ({
  guide: {
    enabled: true,
    saving: false,
    error: null,
    panelOpen: false,
    activeTourId: null,
    stepIndex: 0,
    ...over,
  },
});

describe('guide selectors', () => {
  it('reads scalar fields', () => {
    const s = state({ enabled: false, saving: true, error: 'e', panelOpen: true, stepIndex: 4 });
    expect(selectGuideEnabled(s)).toBe(false);
    expect(selectGuideSaving(s)).toBe(true);
    expect(selectGuideError(s)).toBe('e');
    expect(selectGuidePanelOpen(s)).toBe(true);
    expect(selectStepIndex(s)).toBe(4);
  });

  it('joins the active tour against the registry', () => {
    expect(selectActiveTour(state())).toBeNull();
    expect(selectActiveTour(state({ activeTourId: 'explore-fleet' }))?.id).toBe('explore-fleet');
  });

  it('resolves the active step target and clamps past the last step', () => {
    expect(selectActiveStepTarget(state())).toBeNull();
    expect(selectActiveStepTarget(state({ activeTourId: 'explore-fleet', stepIndex: 0 }))).toBe(
      'fleet-heading',
    );
    expect(selectActiveStepTarget(state({ activeTourId: 'explore-fleet', stepIndex: 2 }))).toBe(
      'agent-name-input',
    );
    // Index past the end clamps to the final step rather than returning null.
    // The explore-fleet tour ends on the "watch it come online" step.
    expect(selectActiveStepTarget(state({ activeTourId: 'explore-fleet', stepIndex: 99 }))).toBe(
      'fleet-table-status',
    );
  });
});
