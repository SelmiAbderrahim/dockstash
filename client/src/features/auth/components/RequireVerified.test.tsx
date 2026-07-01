import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { RequireVerified } from './RequireVerified';
import { authReducer } from '../store/slice';
import type { AuthState } from '../types';

const makeStore = (auth: Partial<AuthState>) =>
  configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: {
        authenticated: false,
        emailVerified: false,
        pendingVerificationEmail: '',
        error: '',
        message: '',
        ...auth,
      },
    },
  });

const renderGuard = (auth: Partial<AuthState>) =>
  render(
    <Provider store={makeStore(auth)}>
      <MemoryRouter initialEntries={['/projects']}>
        <Routes>
          <Route
            path="/projects"
            element={
              <RequireVerified>
                <div>PRODUCT</div>
              </RequireVerified>
            }
          />
          <Route path="/login" element={<div>LOGIN</div>} />
          <Route path="/verify-email" element={<div>VERIFY</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );

describe('RequireVerified', () => {
  it('redirects an unauthenticated user to /login', () => {
    renderGuard({ authenticated: false, emailVerified: false });
    expect(screen.getByText('LOGIN')).toBeInTheDocument();
  });

  it('redirects an authenticated but unverified user to /verify-email', () => {
    renderGuard({ authenticated: true, emailVerified: false });
    expect(screen.getByText('VERIFY')).toBeInTheDocument();
  });

  it('renders children for a verified user', () => {
    renderGuard({ authenticated: true, emailVerified: true });
    expect(screen.getByText('PRODUCT')).toBeInTheDocument();
  });
});
