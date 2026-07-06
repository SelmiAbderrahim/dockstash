import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { authReducer } from '../store/slice';
import type { AuthState } from '../types';
import { RequireRole } from './RequireRole';

const makeStore = (auth: Partial<AuthState>) =>
  configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: {
        authenticated: false,
        emailVerified: false,
        role: '',
        otpChallengeId: '',
        pendingVerificationEmail: '',
        providers: { google: false, github: false },
        providersLoaded: false,
        error: '',
        message: '',
        ...auth,
      },
    },
  });

const renderGuard = (auth: Partial<AuthState>) =>
  render(
    <Provider store={makeStore(auth)}>
      <MemoryRouter initialEntries={['/superadmin']}>
        <Routes>
          <Route
            path="/superadmin"
            element={
              <RequireRole role="Superadmin">
                <div>CONSOLE</div>
              </RequireRole>
            }
          />
          <Route path="/login" element={<div>LOGIN</div>} />
          <Route path="/dashboard" element={<div>DASHBOARD</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );

describe('RequireRole', () => {
  it('redirects an unauthenticated visitor to login', () => {
    renderGuard({ authenticated: false });
    expect(screen.getByText('LOGIN')).toBeInTheDocument();
  });

  it('redirects an authenticated non-matching role to the dashboard', () => {
    renderGuard({ authenticated: true, role: 'Member' });
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
  });

  it('renders children for the matching role', () => {
    renderGuard({ authenticated: true, role: 'Superadmin' });
    expect(screen.getByText('CONSOLE')).toBeInTheDocument();
  });
});
