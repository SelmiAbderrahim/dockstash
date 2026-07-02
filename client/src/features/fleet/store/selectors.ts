import type { RootState } from '@app/store';

export const selectFleet = (state: RootState) => state.fleet.items;
export const selectFleetStatus = (state: RootState) => state.fleet.status;
export const selectFleetError = (state: RootState) => state.fleet.error;
export const selectFleetLockedReason = (state: RootState) => state.fleet.lockedReason;
export const selectRegisterStatus = (state: RootState) => state.fleet.registerStatus;
export const selectRegisterError = (state: RootState) => state.fleet.registerError;
