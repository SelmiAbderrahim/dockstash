import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { authReducer } from '@features/auth';
import { fleetReducer } from '@features/fleet';
import { guideReducer } from '@features/guide';
import { healthReducer } from '@features/health';
import { profileReducer } from '@features/profile';
import { projectsReducer } from '@features/projects';
import { snapshotsReducer } from '@features/snapshots';
import { settingsReducer } from '@features/settings';

const rootReducer = combineReducers({
  auth: authReducer,
  fleet: fleetReducer,
  guide: guideReducer,
  health: healthReducer,
  profile: profileReducer,
  projects: projectsReducer,
  snapshots: snapshotsReducer,
  settings: settingsReducer,
});

// Derived from the reducer (not the store) so there is no store→type cycle.
export type RootState = ReturnType<typeof rootReducer>;

/**
 * Build a fresh store instance. Tests use this so each case gets an isolated
 * store; the browser uses the shared `store` singleton below.
 */
export function makeStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    ...(preloadedState ? { preloadedState } : {}),
  });
}

/** Shared browser singleton. */
export const store = makeStore();

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore['dispatch'];
