import { createSlice } from '@reduxjs/toolkit';
import type { PagesState } from '../types';
import { sendContactForm } from './thunks';

const initialState: PagesState = {
  message: '',
  error: '',
};

const pagesSlice = createSlice({
  name: 'pages',
  initialState,
  reducers: {
    clearStatus(state) {
      state.message = '';
      state.error = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendContactForm.fulfilled, (state, action) => {
        state.message = action.payload;
        state.error = '';
      })
      .addCase(sendContactForm.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not send contact form.';
      });
  },
});

export const { clearStatus } = pagesSlice.actions;
export const pagesReducer = pagesSlice.reducer;
