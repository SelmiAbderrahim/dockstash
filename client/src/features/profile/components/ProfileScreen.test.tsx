import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { ProfileScreen } from './ProfileScreen';
import { guideReducer } from '@features/guide';
import { profileReducer, type ProfileState } from '../store/slice';
import * as thunks from '../store/thunks';
import { i18n, initI18n } from '@shared/i18n';

// Inert thunks: keep the real static matchers (`.pending`/`.fulfilled`/…) so the
// slice's extraReducers still build, but make every dispatch a no-op. This lets
// the tests drive all UI state purely through preloadedState.
vi.mock('../store/thunks', async () => {
  const actual = await vi.importActual<typeof import('../store/thunks')>('../store/thunks');
  const make = (orig: unknown) =>
    Object.assign(
      vi.fn(() => () => Promise.resolve()),
      orig as object,
    );
  return {
    fetchUser: make(actual.fetchUser),
    saveProfile: make(actual.saveProfile),
  };
});

const mocked = vi.mocked(thunks);

const clearCookies = () => {
  document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'uid=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
};

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
  clearCookies();
});

const baseState = (over: Partial<ProfileState> = {}): ProfileState => ({
  profile: {},
  status: 'succeeded',
  saveStatus: 'idle',
  error: null,
  ...over,
});

const renderScreen = (state: Partial<ProfileState> = {}) => {
  const store = configureStore({
    reducer: { profile: profileReducer, guide: guideReducer },
    preloadedState: { profile: baseState(state) },
  });
  render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <ProfileScreen />
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
  return store;
};

describe('ProfileScreen — no session', () => {
  it('shows a sign-in message and never fetches when no cookie is present', () => {
    renderScreen();
    expect(screen.getByText('Sign in to view your profile.')).toBeInTheDocument();
    expect(mocked.fetchUser).not.toHaveBeenCalled();
  });
});

describe('ProfileScreen — with session', () => {
  const withCookie = () => {
    document.cookie = `user=${encodeURIComponent(JSON.stringify({ _id: 'u-1' }))}; path=/`;
  };

  it('fetches the profile on mount', () => {
    withCookie();
    renderScreen({ status: 'loading' });
    expect(mocked.fetchUser).toHaveBeenCalledWith('u-1');
  });

  it('shows a loading indicator while the profile loads', () => {
    withCookie();
    renderScreen({ status: 'loading' });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows an error alert when the load fails', () => {
    withCookie();
    renderScreen({ status: 'failed', error: 'boom' });
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
  });

  it('falls back to a default message when failed with no error', () => {
    withCookie();
    renderScreen({ status: 'failed', error: null });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load your profile.');
  });

  it('prefills the name form from the fetched profile', () => {
    withCookie();
    renderScreen({
      profile: { email: 'me@example.com', firstName: 'Ada', lastName: 'Lovelace', role: 'Admin' },
    });
    expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('Ada');
    expect((screen.getByLabelText('Last name') as HTMLInputElement).value).toBe('Lovelace');
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('me@example.com');
    expect(screen.getByText('Role: Admin')).toBeInTheDocument();
  });

  it('submits the name form', () => {
    withCookie();
    renderScreen({ profile: { email: 'me@example.com', firstName: 'Ada', lastName: 'Lovelace' } });
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Grace' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Hopper' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(mocked.saveProfile).toHaveBeenCalledWith({
      uid: 'u-1',
      firstName: 'Grace',
      lastName: 'Hopper',
    });
  });

  it('shows the saving state while a save is in flight', () => {
    withCookie();
    renderScreen({ saveStatus: 'loading' });
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });

  it('shows the saved confirmation after a successful save', () => {
    withCookie();
    renderScreen({ saveStatus: 'succeeded' });
    expect(screen.getByText('Profile saved.')).toBeInTheDocument();
  });

  it('shows the API error when a save fails', () => {
    withCookie();
    renderScreen({ saveStatus: 'failed', error: 'name taken' });
    expect(screen.getByText('name taken')).toBeInTheDocument();
  });

  it('falls back to a generic save error when a save fails without a message', () => {
    withCookie();
    renderScreen({ saveStatus: 'failed', error: null });
    expect(screen.getByText('Could not save your profile.')).toBeInTheDocument();
  });

  it('renders the GuideMeToggle', () => {
    withCookie();
    renderScreen();
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('falls back to email-derived initials when no name is set', () => {
    withCookie();
    renderScreen({ profile: { email: 'zz@example.com' } });
    expect(screen.getByText('ZZ')).toBeInTheDocument();
  });
});
