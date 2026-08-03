import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { authReducer } from '@features/auth';
import { i18n, initI18n } from '@shared/i18n';
import { guideReducer } from '../store/slice';
import { GuideWidget } from './GuideWidget';

const renderWidget = (authenticated: boolean, enabled: boolean) => {
  const store = configureStore({
    reducer: { auth: authReducer, guide: guideReducer },
    preloadedState: {
      auth: {
        authenticated,
        emailVerified: authenticated,
        role: '',
        pendingVerificationEmail: '',
        providers: { google: false, github: false },
        providersLoaded: false,
        error: '',
        message: '',
      },
      guide: {
        enabled,
        saving: false,
        error: null,
        panelOpen: false,
        activeTourId: null,
        stepIndex: 0,
      },
    },
  });
  render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <GuideWidget />
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
};

beforeEach(() => {
  window.localStorage.clear();
  initI18n({ initialLocale: 'en' });
});

describe('GuideWidget', () => {
  it('renders nothing for anonymous visitors', () => {
    renderWidget(false, true);
    expect(screen.queryByRole('button', { name: 'Open the guide' })).not.toBeInTheDocument();
  });

  it('renders nothing when the preference is off', () => {
    renderWidget(true, false);
    expect(screen.queryByRole('button', { name: 'Open the guide' })).not.toBeInTheDocument();
  });

  it('renders the launcher for an authenticated user with the guide on', () => {
    renderWidget(true, true);
    expect(screen.getByRole('button', { name: 'Open the guide' })).toBeInTheDocument();
  });
});
