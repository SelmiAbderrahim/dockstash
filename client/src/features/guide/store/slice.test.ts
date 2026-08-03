import { beforeEach, describe, expect, it } from 'vitest';
import { removeCookie, saveCookie } from '@shared/utils/cookies';
import {
  closePanel,
  endTour,
  guideReducer,
  nextStep,
  openPanel,
  prevStep,
  readGuideEnabled,
  startTour,
} from './slice';
import { setGuideMe } from './thunks';
import type { GuideState } from '../types';

const initial = () => guideReducer(undefined, { type: 'noop' });

beforeEach(() => {
  removeCookie('user');
});

describe('readGuideEnabled', () => {
  it('defaults to enabled without a cookie or field', () => {
    expect(readGuideEnabled()).toBe(true);
    saveCookie('user', { id: 'u1', email: 'a@b.c' });
    expect(readGuideEnabled()).toBe(true);
  });

  it('honours an explicit guideMe=false', () => {
    saveCookie('user', { id: 'u1', guideMe: false });
    expect(readGuideEnabled()).toBe(false);
  });
});

describe('panel + tour reducers', () => {
  it('opens and closes the panel, clearing errors on open', () => {
    let state: GuideState = { ...initial(), error: 'boom' };
    state = guideReducer(state, openPanel());
    expect(state.panelOpen).toBe(true);
    expect(state.error).toBeNull();
    state = guideReducer(state, closePanel());
    expect(state.panelOpen).toBe(false);
  });

  it('starts a tour at the requested step and closes the panel', () => {
    let state = guideReducer(initial(), openPanel());
    state = guideReducer(state, startTour({ tourId: 'a', stepIndex: 2 }));
    expect(state).toMatchObject({ panelOpen: false, activeTourId: 'a', stepIndex: 2 });
    state = guideReducer(state, startTour({ tourId: 'b' }));
    expect(state.stepIndex).toBe(0);
  });

  it('steps forward and backward with a floor at 0', () => {
    let state = guideReducer(initial(), startTour({ tourId: 'a' }));
    state = guideReducer(state, nextStep());
    expect(state.stepIndex).toBe(1);
    state = guideReducer(state, prevStep());
    state = guideReducer(state, prevStep());
    expect(state.stepIndex).toBe(0);
  });

  it('ends the tour and resets the index', () => {
    let state = guideReducer(initial(), startTour({ tourId: 'a', stepIndex: 3 }));
    state = guideReducer(state, endTour());
    expect(state).toMatchObject({ activeTourId: null, stepIndex: 0 });
  });
});

describe('setGuideMe lifecycle', () => {
  it('tracks saving and applies the new value', () => {
    let state = guideReducer(initial(), { type: setGuideMe.pending.type });
    expect(state.saving).toBe(true);
    state = guideReducer(state, { type: setGuideMe.fulfilled.type, payload: true });
    expect(state).toMatchObject({ saving: false, enabled: true });
  });

  it('disabling also dismisses the panel and any running tour', () => {
    let state = guideReducer(initial(), startTour({ tourId: 'a', stepIndex: 1 }));
    state = guideReducer(state, openPanel());
    state = guideReducer(state, { type: setGuideMe.fulfilled.type, payload: false });
    expect(state).toMatchObject({
      enabled: false,
      panelOpen: false,
      activeTourId: null,
      stepIndex: 0,
    });
  });

  it('keeps the previous value and surfaces the error on rejection', () => {
    let state = guideReducer(initial(), { type: setGuideMe.rejected.type, payload: 'nope' });
    expect(state).toMatchObject({ saving: false, error: 'nope' });
    state = guideReducer(initial(), { type: setGuideMe.rejected.type });
    expect(state.error).toBe('Could not update the guide preference.');
  });
});
