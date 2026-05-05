import type { RootState } from '@app/store';

export const selectPagesMessage = (state: RootState): string => state.pages.message;
export const selectPagesError = (state: RootState): string => state.pages.error;
