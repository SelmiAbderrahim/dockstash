import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { authReducer } from '@features/auth';
import { billingReducer } from '@features/billing';
import { dashboardReducer } from '@features/dashboard';
import { projectsReducer } from '@features/projects';
import { snapshotsReducer } from '@features/snapshots';
import { settingsReducer } from '@features/settings';

const rootReducer = combineReducers({
  auth: authReducer,
  billing: billingReducer,
  dashboard: dashboardReducer,
  projects: projectsReducer,
  snapshots: snapshotsReducer,
  settings: settingsReducer,
});

// Derived from the reducer (not the store) so there is no store→type cycle.
export type RootState = ReturnType<typeof rootReducer>;

/**
 * Build a fresh store instance. Used on the server so every SSR request gets
 * an isolated store (a module-level singleton would leak state across
 * requests). The browser uses the shared `store` singleton below.
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
