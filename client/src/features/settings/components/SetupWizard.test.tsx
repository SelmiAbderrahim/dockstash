import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { SetupWizard } from './SetupWizard';
import { settingsReducer, type SettingsState } from '../store/slice';
import { i18n, initI18n } from '@shared/i18n';
import * as api from '../api';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../api', () => ({
  fetchStorageRequest: vi.fn(),
  saveStorageRequest: vi.fn(),
  testStorageRequest: vi.fn(),
  fetchRetentionRequest: vi.fn(),
  saveRetentionRequest: vi.fn(),
  savePasswordRequest: vi.fn(),
}));

const mocked = vi.mocked(api);

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const baseState = (over: Partial<SettingsState> = {}): SettingsState => ({
  storage: { host: '', user: '', port: 22, configured: false },
  storageStatus: 'succeeded',
  storageSaveStatus: 'idle',
  storageTestStatus: 'idle',
  retention: null,
  retentionStatus: 'idle',
  retentionSaveStatus: 'idle',
  passwordSaveStatus: 'idle',
  error: null,
  ...over,
});

const renderWizard = (settings: Partial<SettingsState> = {}) => {
  const store = configureStore({
    reducer: { settings: settingsReducer },
    preloadedState: { settings: baseState(settings) },
  });
  render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <SetupWizard />
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
  return store;
};

const fillStorage = () => {
  fireEvent.change(screen.getByLabelText('Host'), { target: { value: 'ssh.example' } });
  fireEvent.change(screen.getByLabelText('User'), { target: { value: 'deploy' } });
  fireEvent.change(screen.getByLabelText('Port'), { target: { value: '2222' } });
  fireEvent.change(screen.getByLabelText('SSH private key'), { target: { value: 'KEY' } });
};

describe('SetupWizard', () => {
  it('shows a loading spinner while storage status is not yet resolved', () => {
    renderWizard({ storageStatus: 'idle', storage: null });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders nothing once storage is already configured', () => {
    // The loaded wizard is now a shadcn Card (no `.ds-wizard` wrapper), so a
    // `.ds-wizard` query would pass vacuously. Assert the real intent instead:
    // when storage is configured the component renders neither the loading
    // status nor the wizard heading — it returns nothing.
    renderWizard({ storage: { host: 'h', user: 'root', port: 22, configured: true } });
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Set up your storage' })).toBeNull();
  });

  it('renders the wizard when setup is needed and surfaces store errors', () => {
    renderWizard({ error: 'something failed' });
    expect(screen.getByRole('heading', { name: 'Set up your storage' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('something failed');
  });

  it('stays on the storage step when saving storage fails', async () => {
    mocked.saveStorageRequest.mockRejectedValue(new Error('nope'));
    renderWizard();
    fillStorage();
    fireEvent.click(screen.getByRole('button', { name: 'Connect storage' }));
    await waitFor(() => expect(mocked.saveStorageRequest).toHaveBeenCalled());
    expect(screen.queryByTestId('wizard-password')).toBeNull();
    expect(mocked.testStorageRequest).not.toHaveBeenCalled();
  });

  it('shows the connecting state while the storage save is in flight', async () => {
    mocked.saveStorageRequest.mockReturnValue(new Promise(() => {}));
    renderWizard();
    fillStorage();
    fireEvent.click(screen.getByRole('button', { name: 'Connect storage' }));
    expect(await screen.findByRole('button', { name: 'Connecting…' })).toBeDisabled();
  });

  it('disables the connect button while the storage test is in flight', async () => {
    mocked.saveStorageRequest.mockResolvedValue({
      host: 'ssh.example',
      user: 'root',
      port: 2222,
      configured: false,
    });
    mocked.testStorageRequest.mockReturnValue(new Promise(() => {}));
    renderWizard();
    fillStorage();
    fireEvent.click(screen.getByRole('button', { name: 'Connect storage' }));
    await waitFor(() => expect(mocked.testStorageRequest).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Connect storage' })).toBeDisabled();
  });

  it('walks the full happy path and navigates to projects', async () => {
    mocked.saveStorageRequest.mockResolvedValue({
      host: 'ssh.example',
      user: 'root',
      port: 2222,
      configured: false,
    });
    mocked.testStorageRequest.mockResolvedValue({ ok: true });
    mocked.savePasswordRequest.mockResolvedValue({ ok: true });
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    renderWizard();
    fillStorage();
    fireEvent.click(screen.getByRole('button', { name: 'Connect storage' }));

    const passwordBlock = await screen.findByTestId('wizard-password');
    expect(passwordBlock).toBeInTheDocument();
    const generated = passwordBlock.querySelector('code')?.textContent ?? '';
    expect(generated.length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(generated);

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const escrow = await screen.findByTestId('wizard-escrow');
    const done = screen.getByTestId('wizard-done') as HTMLButtonElement;
    expect(done.disabled).toBe(true);
    fireEvent.click(escrow);
    expect(done.disabled).toBe(false);
    fireEvent.click(done);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/projects'));
    expect(mocked.savePasswordRequest).toHaveBeenCalledWith(generated);
  });

  it('shows the saving state while the password save is in flight', async () => {
    mocked.saveStorageRequest.mockResolvedValue({
      host: 'ssh.example',
      user: 'root',
      port: 2222,
      configured: false,
    });
    mocked.testStorageRequest.mockResolvedValue({ ok: true });
    mocked.savePasswordRequest.mockReturnValue(new Promise(() => {}));
    renderWizard();
    fillStorage();
    fireEvent.click(screen.getByRole('button', { name: 'Connect storage' }));
    await screen.findByTestId('wizard-password');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();
  });

  it('stays on the password step when saving the password fails', async () => {
    mocked.saveStorageRequest.mockResolvedValue({
      host: 'ssh.example',
      user: 'root',
      port: 2222,
      configured: false,
    });
    mocked.testStorageRequest.mockResolvedValue({ ok: true });
    mocked.savePasswordRequest.mockRejectedValue(new Error('bad'));
    renderWizard();
    fillStorage();
    fireEvent.click(screen.getByRole('button', { name: 'Connect storage' }));
    await screen.findByTestId('wizard-password');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(mocked.savePasswordRequest).toHaveBeenCalled());
    expect(screen.queryByTestId('wizard-escrow')).toBeNull();
  });

  it('generates a password even when the Web Crypto API is unavailable', async () => {
    mocked.saveStorageRequest.mockResolvedValue({
      host: 'ssh.example',
      user: 'root',
      port: 2222,
      configured: false,
    });
    mocked.testStorageRequest.mockResolvedValue({ ok: true });
    vi.stubGlobal('crypto', undefined);
    renderWizard();
    fillStorage();
    fireEvent.click(screen.getByRole('button', { name: 'Connect storage' }));
    const passwordBlock = await screen.findByTestId('wizard-password');
    expect(passwordBlock.querySelector('code')?.textContent?.length).toBeGreaterThan(0);
  });
});
