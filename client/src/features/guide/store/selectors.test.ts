import { describe, expect, it } from 'vitest';
import type { GuideState } from '../types';
import {
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
});
