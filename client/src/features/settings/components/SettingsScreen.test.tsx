import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { SettingsScreen } from './SettingsScreen';
import { settingsReducer, type SettingsState } from '../store/slice';
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
    fetchStorage: make(actual.fetchStorage),
    fetchRetention: make(actual.fetchRetention),
    saveStorage: make(actual.saveStorage),
    saveRetention: make(actual.saveRetention),
    savePassword: make(actual.savePassword),
    testStorage: make(actual.testStorage),
  };
});

const mocked = vi.mocked(thunks);

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
});

const baseState = (over: Partial<SettingsState> = {}): SettingsState => ({
  storage: null,
  storageStatus: 'succeeded',
  storageSaveStatus: 'idle',
  storageTestStatus: 'idle',
  retention: null,
  retentionStatus: 'succeeded',
  retentionSaveStatus: 'idle',
  passwordSaveStatus: 'idle',
  error: null,
  ...over,
});

const renderScreen = (settings: Partial<SettingsState> = {}, entry = '/settings') => {
  const store = configureStore({
    reducer: { settings: settingsReducer },
    preloadedState: { settings: baseState(settings) },
  });
  render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[entry]}>
          <SettingsScreen />
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
  return store;
};

describe('SettingsScreen shell', () => {
  it('dispatches storage + retention fetches on mount and renders the tabs', () => {
    renderScreen();
    expect(mocked.fetchStorage).toHaveBeenCalled();
    expect(mocked.fetchRetention).toHaveBeenCalled();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('switches tabs through the tablist', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('tab', { name: 'Retention' }));
    expect(screen.getByRole('tab', { name: 'Retention' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Encryption password' }));
    expect(screen.getByRole('tab', { name: 'Encryption password' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

describe('SettingsScreen — Storage tab', () => {
  it('shows a loading indicator while storage loads', () => {
    renderScreen({ storageStatus: 'loading' });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows the error text when storage load fails', () => {
    renderScreen({ storageStatus: 'failed', error: 'boom' });
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
  });

  it('falls back to a default message when failed with no error', () => {
    renderScreen({ storageStatus: 'failed', error: null });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load settings.');
  });

  it('prefills fields from an existing storage config', () => {
    renderScreen({
      storage: { host: 'ssh.example', user: 'deploy', port: 2222, configured: true },
    });
    expect((screen.getByLabelText('Host') as HTMLInputElement).value).toBe('ssh.example');
    expect((screen.getByLabelText('User') as HTMLInputElement).value).toBe('deploy');
    expect((screen.getByLabelText('Port') as HTMLInputElement).value).toBe('2222');
  });

  it('defaults user to root and port to 22 when the config omits them', () => {
    renderScreen({
      storage: { host: 'h', user: '', port: 0, configured: false },
    });
    expect((screen.getByLabelText('User') as HTMLInputElement).value).toBe('root');
    expect((screen.getByLabelText('Port') as HTMLInputElement).value).toBe('22');
  });

  it('renders the empty form when there is no stored config', () => {
    renderScreen({ storage: null });
    expect((screen.getByLabelText('Host') as HTMLInputElement).value).toBe('');
  });

  it('submits the storage form', () => {
    renderScreen({ storage: null });
    fireEvent.change(screen.getByLabelText('Host'), { target: { value: 'newhost' } });
    fireEvent.change(screen.getByLabelText('User'), { target: { value: 'deploy' } });
    fireEvent.change(screen.getByLabelText('Port'), { target: { value: '2200' } });
    fireEvent.change(screen.getByLabelText(/SSH private key/), { target: { value: 'KEY' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect storage' }));
    expect(mocked.saveStorage).toHaveBeenCalledWith({
      host: 'newhost',
      user: 'deploy',
      port: 2200,
      privateKey: 'KEY',
    });
  });

  it('shows the saving state while a save is in flight', () => {
    renderScreen({ storageSaveStatus: 'loading' });
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });

  it('shows the saved confirmation after a successful save', () => {
    renderScreen({ storageSaveStatus: 'succeeded' });
    expect(screen.getByText('Storage saved.')).toBeInTheDocument();
  });
});

describe('SettingsScreen — Retention tab', () => {
  const entry = '/settings?tab=retention';

  it('prefills from an existing retention policy and submits', () => {
    renderScreen({ retention: { keepDaily: 10, keepWeekly: 5, keepMonthly: 2 } }, entry);
    expect((screen.getByLabelText('Keep last N daily') as HTMLInputElement).value).toBe('10');
    fireEvent.change(screen.getByLabelText('Keep last N daily'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Keep last N weekly'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Keep last N monthly'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(mocked.saveRetention).toHaveBeenCalledWith({
      keepDaily: 9,
      keepWeekly: 8,
      keepMonthly: 3,
    });
  });

  it('renders defaults when there is no policy', () => {
    renderScreen({ retention: null }, entry);
    expect((screen.getByLabelText('Keep last N daily') as HTMLInputElement).value).toBe('7');
  });

  it('shows saving and saved states', () => {
    renderScreen({ retentionSaveStatus: 'loading' }, entry);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });

  it('shows the saved confirmation', () => {
    renderScreen({ retentionSaveStatus: 'succeeded' }, entry);
    expect(screen.getByText('Retention saved.')).toBeInTheDocument();
  });
});

describe('SettingsScreen — Password tab', () => {
  const entry = '/settings?tab=password';

  it('does not submit while the form is invalid', () => {
    renderScreen({}, entry);
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } });
    fireEvent.submit(screen.getByLabelText('New password').closest('form') as HTMLFormElement);
    expect(mocked.savePassword).not.toHaveBeenCalled();
  });

  it('shows a mismatch error when the confirmation differs', () => {
    renderScreen({}, entry);
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'longenoughpass1' },
    });
    fireEvent.change(screen.getByLabelText(/Confirm password/), {
      target: { value: 'different1234' },
    });
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm password/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('submits a valid password and resets the fields', () => {
    renderScreen({}, entry);
    const pw = screen.getByLabelText('New password') as HTMLInputElement;
    const confirm = screen.getByLabelText(/Confirm password/) as HTMLInputElement;
    fireEvent.change(pw, { target: { value: 'longenoughpass1' } });
    fireEvent.change(confirm, { target: { value: 'longenoughpass1' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(mocked.savePassword).toHaveBeenCalledWith('longenoughpass1');
    expect(pw.value).toBe('');
    expect(confirm.value).toBe('');
  });

  it('shows saving and saved states', () => {
    renderScreen({ passwordSaveStatus: 'loading' }, entry);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });

  it('shows the saved confirmation', () => {
    renderScreen({ passwordSaveStatus: 'succeeded' }, entry);
    expect(screen.getByText('Password saved.')).toBeInTheDocument();
  });
});
