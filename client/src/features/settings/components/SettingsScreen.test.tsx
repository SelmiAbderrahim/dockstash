import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    exportConfig: make(actual.exportConfig),
    generateRecoveryCodes: make(actual.generateRecoveryCodes),
    triggerSelfBackup: make(actual.triggerSelfBackup),
    fetchSelfBackupRuns: make(actual.fetchSelfBackupRuns),
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
  exportStatus: 'idle',
  recoveryCodes: null,
  recoveryCodesStatus: 'idle',
  selfBackupTriggerStatus: 'idle',
  selfBackupRuns: [],
  selfBackupRunsStatus: 'succeeded',
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
    expect(screen.getAllByRole('tab')).toHaveLength(4);
  });

  it('switches tabs through the tablist', async () => {
    // Radix Tabs activate on mousedown, so drive them with user-event, not fireEvent.
    const user = userEvent.setup();
    renderScreen();
    await user.click(screen.getByRole('tab', { name: 'Retention' }));
    expect(screen.getByRole('tab', { name: 'Retention' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.click(screen.getByRole('tab', { name: 'Encryption password' }));
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
      storage: {
        host: 'ssh.example',
        user: 'deploy',
        port: 2222,
        configured: true,
        passwordSet: false,
      },
    });
    expect((screen.getByLabelText('Host') as HTMLInputElement).value).toBe('ssh.example');
    expect((screen.getByLabelText('User') as HTMLInputElement).value).toBe('deploy');
    expect((screen.getByLabelText('Port') as HTMLInputElement).value).toBe('2222');
  });

  it('defaults user to root and port to 22 when the config omits them', () => {
    renderScreen({
      storage: { host: 'h', user: '', port: 0, configured: false, passwordSet: false },
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

  it('shows the API error when a save fails', () => {
    renderScreen({ storageSaveStatus: 'failed', error: 'endpoint missing' });
    expect(screen.getByRole('alert')).toHaveTextContent('endpoint missing');
  });

  it('falls back to a generic save error when a save fails without a message', () => {
    renderScreen({ storageSaveStatus: 'failed', error: null });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save settings.');
  });

  it('disables the test-connection button until storage is configured', () => {
    renderScreen({ storage: null });
    expect(screen.getByRole('button', { name: 'Test connection' })).toBeDisabled();
  });

  it('dispatches testStorage from the test-connection button when configured', () => {
    renderScreen({
      storage: { host: 'h', user: 'root', port: 22, configured: true, passwordSet: false },
    });
    const button = screen.getByRole('button', { name: 'Test connection' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(mocked.testStorage).toHaveBeenCalled();
  });

  it('shows the testing state while a test is in flight', () => {
    renderScreen({
      storageTestStatus: 'loading',
      storage: { host: 'h', user: 'root', port: 22, configured: true, passwordSet: false },
    });
    expect(screen.getByRole('button', { name: 'Testing…' })).toBeDisabled();
  });

  it('shows the success notice after a passing test', () => {
    renderScreen({ storageTestStatus: 'succeeded' });
    expect(screen.getByText('Connection succeeded.')).toBeInTheDocument();
  });

  it('shows the API error when a test fails', () => {
    renderScreen({ storageTestStatus: 'failed', error: 'connection refused' });
    expect(screen.getByRole('alert')).toHaveTextContent('connection refused');
  });

  it('falls back to a generic test error when a test fails without a message', () => {
    renderScreen({ storageTestStatus: 'failed', error: null });
    expect(screen.getByRole('alert')).toHaveTextContent('Connection failed.');
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

  it('shows a save error when the save fails', () => {
    renderScreen({ retentionSaveStatus: 'failed' }, entry);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save settings.');
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
    fireEvent.click(screen.getByRole('switch'));
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

  it('shows a save error when the save fails', () => {
    renderScreen({ passwordSaveStatus: 'failed' }, entry);
    // The static escrow warning Alert is also role=alert; match the save error.
    expect(screen.getByText('Could not save settings.')).toBeInTheDocument();
  });

  it('shows the persistent "password set" badge when one is configured', () => {
    renderScreen(
      {
        storage: { host: '', user: '', port: 22, configured: false, passwordSet: true },
      },
      entry,
    );
    expect(screen.getByText('An encryption password is set.')).toBeInTheDocument();
  });

  it('hides the "password set" badge when none is configured', () => {
    renderScreen(
      {
        storage: { host: '', user: '', port: 22, configured: false, passwordSet: false },
      },
      entry,
    );
    expect(screen.queryByText('An encryption password is set.')).not.toBeInTheDocument();
  });
});

describe('SettingsScreen — Recovery tab', () => {
  const entry = '/settings?tab=recovery';
  const runs = [
    {
      id: 'r1',
      repo: 'ssh:self/repo',
      status: 'success',
      startedAt: '2026-07-01T00:00:00.000Z',
      finishedAt: '2026-07-01T00:01:00.000Z',
      error: '',
    },
    {
      id: 'r2',
      repo: 'ssh:self/repo',
      status: 'failed',
      startedAt: null,
      finishedAt: null,
      error: 'ssh timeout',
    },
    {
      id: 'r3',
      repo: 'ssh:self/repo',
      status: 'running',
      startedAt: '2026-07-02T00:00:00.000Z',
      finishedAt: null,
      error: '',
    },
  ];

  it('fetches self-backup runs on mount and renders the three sections', () => {
    renderScreen({}, entry);
    expect(mocked.fetchSelfBackupRuns).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Export configuration')).toBeInTheDocument();
    expect(screen.getByText('Recovery codes')).toBeInTheDocument();
    expect(screen.getByText('Self-backup')).toBeInTheDocument();
  });

  it('dispatches exportConfig from the download button', () => {
    renderScreen({}, entry);
    fireEvent.click(screen.getByRole('button', { name: /Download export/ }));
    expect(mocked.exportConfig).toHaveBeenCalled();
  });

  it('disables the export button while exporting', () => {
    renderScreen({ exportStatus: 'loading' }, entry);
    expect(screen.getByRole('button', { name: /Exporting…/ })).toBeDisabled();
  });

  it('shows the export success notice', () => {
    renderScreen({ exportStatus: 'succeeded' }, entry);
    expect(screen.getByText('Export downloaded.')).toBeInTheDocument();
  });

  it('dispatches generateRecoveryCodes from the generate button', () => {
    renderScreen({}, entry);
    fireEvent.click(screen.getByRole('button', { name: /Generate recovery codes/ }));
    expect(mocked.generateRecoveryCodes).toHaveBeenCalled();
  });

  it('disables the generate button while codes are generating', () => {
    renderScreen({ recoveryCodesStatus: 'loading' }, entry);
    expect(screen.getByRole('button', { name: /Generating…/ })).toBeDisabled();
  });

  it('displays generated codes once, with warning and copy-all', async () => {
    const user = userEvent.setup();
    renderScreen(
      {
        recoveryCodesStatus: 'succeeded',
        recoveryCodes: { message: 'Escrow enabled.', codes: ['AAAA-1111', 'BBBB-2222'] },
      },
      entry,
    );
    expect(screen.getByText(/never be shown again/)).toBeInTheDocument();
    expect(screen.getByText('Escrow enabled.')).toBeInTheDocument();
    expect(screen.getByText('AAAA-1111')).toBeInTheDocument();
    expect(screen.getByText('BBBB-2222')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Copy all/ }));
    expect(await screen.findByText('Copied.')).toBeInTheDocument();
    await expect(navigator.clipboard.readText()).resolves.toBe('AAAA-1111\nBBBB-2222');
  });

  it('triggers a self-backup and refreshes the runs list', async () => {
    renderScreen({}, entry);
    fireEvent.click(screen.getByRole('button', { name: /Run self-backup/ }));
    expect(mocked.triggerSelfBackup).toHaveBeenCalled();
    // Once on mount, once after the trigger resolves.
    await waitFor(() => expect(mocked.fetchSelfBackupRuns).toHaveBeenCalledTimes(2));
  });

  it('disables the trigger button while the trigger is in flight', () => {
    renderScreen({ selfBackupTriggerStatus: 'loading' }, entry);
    expect(screen.getByRole('button', { name: /Triggering…/ })).toBeDisabled();
  });

  it('shows the triggered confirmation', () => {
    renderScreen({ selfBackupTriggerStatus: 'succeeded' }, entry);
    expect(screen.getByText('Self-backup triggered.')).toBeInTheDocument();
  });

  it('renders inline errors for every failed action', () => {
    renderScreen(
      {
        exportStatus: 'failed',
        recoveryCodesStatus: 'failed',
        selfBackupTriggerStatus: 'failed',
        selfBackupRunsStatus: 'failed',
        error: 'boom',
      },
      entry,
    );
    expect(screen.getAllByText('boom')).toHaveLength(4);
  });

  it('falls back to generic errors when no message is present', () => {
    renderScreen(
      {
        exportStatus: 'failed',
        recoveryCodesStatus: 'failed',
        selfBackupTriggerStatus: 'failed',
        selfBackupRunsStatus: 'failed',
        error: null,
      },
      entry,
    );
    expect(screen.getAllByText('Could not save settings.')).toHaveLength(3);
    expect(screen.getByText('Could not load settings.')).toBeInTheDocument();
  });

  it('shows a loading indicator while runs load', () => {
    renderScreen({ selfBackupRunsStatus: 'loading' }, entry);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows an empty message when there are no runs', () => {
    renderScreen({ selfBackupRuns: [], selfBackupRunsStatus: 'succeeded' }, entry);
    expect(screen.getByText('No self-backup runs yet.')).toBeInTheDocument();
  });

  it('renders the recent runs with status badges, times, and errors', () => {
    renderScreen({ selfBackupRuns: runs, selfBackupRunsStatus: 'succeeded' }, entry);
    expect(screen.getByText('success')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByText('ssh timeout')).toBeInTheDocument();
    // Missing timestamps render as em-dash placeholders.
    expect(screen.getByText('— – —')).toBeInTheDocument();
  });
});
