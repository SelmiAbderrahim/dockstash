import { configureStore } from '@reduxjs/toolkit';
import { authReducer } from '@features/auth';
import { billingReducer } from '@features/billing';
import { dashboardReducer } from '@features/dashboard';
import { messagingReducer } from '@features/messaging';
import { pagesReducer } from '@features/pages';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    billing: billingReducer,
    dashboard: dashboardReducer,
    messaging: messagingReducer,
    pages: pagesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
