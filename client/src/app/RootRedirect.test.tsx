import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { authReducer } from '@features/auth';
import type { AuthState } from '@features/auth';
import { RootRedirect } from './RootRedirect';

const renderAt = (entry: string, auth: Partial<AuthState>) =>
  render(
    <Provider
      store={configureStore({
        reducer: { auth: authReducer },
        preloadedState: { auth: auth as AuthState },
      })}
    >
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<RootRedirect />} />
          <Route path="/login" element={<div>LOGIN</div>} />
          <Route path="/dashboard" element={<div>DASHBOARD</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );

describe('RootRedirect', () => {
  it('sends an anonymous visitor to the login screen', () => {
    renderAt('/', { authenticated: false });
    expect(screen.getByText('LOGIN')).toBeInTheDocument();
  });

  it('sends a signed-in visitor to the dashboard', () => {
    renderAt('/', { authenticated: true });
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
  });

  it('catches an unknown URL', () => {
    renderAt('/pricing', { authenticated: false });
    expect(screen.getByText('LOGIN')).toBeInTheDocument();
  });
});
