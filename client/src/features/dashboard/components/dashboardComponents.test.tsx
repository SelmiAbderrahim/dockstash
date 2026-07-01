import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { Dashboard } from './Dashboard';
import { ViewProfile } from './ViewProfile';
import { UserInfo } from './UserInfo';
import { dashboardReducer } from '../store/slice';
import { i18n, initI18n } from '@shared/i18n';
import * as api from '../api';

vi.mock('../api', () => ({ fetchUserRequest: vi.fn() }));
const mocked = vi.mocked(api);

const clearCookies = () => {
  document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'uid=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
};

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
  clearCookies();
});

const makeStore = () => configureStore({ reducer: { dashboard: dashboardReducer } });

const renderComp = (ui: React.ReactNode) =>
  render(
    <Provider store={makeStore()}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>{ui}</MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );

describe('Dashboard', () => {
  it('renders the core product navigation links', () => {
    renderComp(<Dashboard />);
    expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Snapshots' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Billing' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument();
  });

  it('shows the admin link only for admins', () => {
    document.cookie = `user=${encodeURIComponent(JSON.stringify({ role: 'Admin' }))}; path=/`;
    renderComp(<Dashboard />);
    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument();
  });

  it('hides the admin link for non-admins (no user cookie)', () => {
    renderComp(<Dashboard />);
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });
});

describe('ViewProfile', () => {
  it('fetches the user by the id in the user cookie and renders the email', async () => {
    document.cookie = `user=${encodeURIComponent(JSON.stringify({ _id: 'u-1' }))}; path=/`;
    mocked.fetchUserRequest.mockResolvedValue({ user: { email: 'me@example.com' } });
    renderComp(<ViewProfile />);
    await waitFor(() => expect(mocked.fetchUserRequest).toHaveBeenCalledWith('u-1'));
    expect(await screen.findByText('me@example.com')).toBeInTheDocument();
  });

  it('falls back to the uid cookie when the user cookie has no id', async () => {
    document.cookie = 'uid=u-2; path=/';
    mocked.fetchUserRequest.mockResolvedValue({ user: { email: 'two@example.com' } });
    renderComp(<ViewProfile />);
    await waitFor(() => expect(mocked.fetchUserRequest).toHaveBeenCalledWith('u-2'));
  });

  it('does not fetch when no id is available', () => {
    renderComp(<ViewProfile />);
    expect(mocked.fetchUserRequest).not.toHaveBeenCalled();
  });
});

describe('UserInfo', () => {
  it('renders the provided profile string', () => {
    render(<UserInfo profile="hello@world.dev" />);
    expect(screen.getByText('hello@world.dev')).toBeInTheDocument();
  });
});
