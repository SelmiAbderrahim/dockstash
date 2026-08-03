import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { loadCookie } from '@shared/utils/cookies';
import type { GuideState } from '../types';
import { setGuideMe } from './thunks';

/** Absent cookie or absent field means enabled — existing users default on. */
export const readGuideEnabled = (): boolean =>
  loadCookie<{ guideMe?: boolean }>('user')?.guideMe !== false;

const initialState: GuideState = {
  enabled: readGuideEnabled(),
  saving: false,
  error: null,
  panelOpen: false,
  activeTourId: null,
  stepIndex: 0,
};

const slice = createSlice({
  name: 'guide',
  initialState,
  reducers: {
    openPanel(state) {
      state.panelOpen = true;
      state.error = null;
    },
    closePanel(state) {
      state.panelOpen = false;
    },
    startTour(state, action: PayloadAction<{ tourId: string; stepIndex?: number }>) {
      state.panelOpen = false;
      state.activeTourId = action.payload.tourId;
      state.stepIndex = action.payload.stepIndex ?? 0;
    },
    nextStep(state) {
      state.stepIndex += 1;
    },
    prevStep(state) {
      state.stepIndex = Math.max(0, state.stepIndex - 1);
    },
    endTour(state) {
      state.activeTourId = null;
      state.stepIndex = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(setGuideMe.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(setGuideMe.fulfilled, (state, action) => {
        state.saving = false;
        state.enabled = action.payload;
        if (!action.payload) {
          state.panelOpen = false;
          state.activeTourId = null;
          state.stepIndex = 0;
        }
      })
      .addCase(setGuideMe.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload ?? 'Could not update the guide preference.';
      });
  },
});

export const { openPanel, closePanel, startTour, nextStep, prevStep, endTour } = slice.actions;
export const guideReducer = slice.reducer;
