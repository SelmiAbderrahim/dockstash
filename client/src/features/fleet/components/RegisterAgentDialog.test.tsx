import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { configureStore } from '@reduxjs/toolkit';
import { RegisterAgentDialog } from './RegisterAgentDialog';
import { fleetReducer, type FleetState } from '../store/slice';
import * as api from '../api';
import { i18n, initI18n } from '@shared/i18n';

vi.mock('../api', () => ({
  listAgentsRequest: vi.fn(),
  registerAgentRequest: vi.fn(),
  fetchFleetRequest: vi.fn(async () => []),
}));

const mocked = vi.mocked(api);

const registered = {
  agent: {
    id: 'a1',
    name: 'web-1',
    host: 'vps1.example',
    port: 7443,
    status: 'offline' as const,
    lastSeenAt: null,
  },
  token: 'dsa_0123456789abcdef01234567.abc',
};

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const renderDialog = (
  props: Partial<React.ComponentProps<typeof RegisterAgentDialog>> = {},
  fleet: Partial<FleetState> = {},
) => {
  const store = configureStore({
    reducer: { fleet: fleetReducer },
    preloadedState: {
      fleet: {
        items: [],
        status: 'idle',
        error: null,
        lockedReason: null,
        registerStatus: 'idle',
        registerError: null,
        rotateStatus: 'idle',
        rotateError: null,
        deleteStatus: 'idle',
        deleteError: null,
        ...fleet,
      } satisfies FleetState,
    },
  });
  render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <RegisterAgentDialog open onClose={() => {}} {...props} />
      </I18nextProvider>
    </Provider>,
  );
  return store;
};

const fillForm = (port?: string) => {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'web-1' } });
  fireEvent.change(screen.getByLabelText('Host'), { target: { value: 'vps1.example' } });
  if (port) fireEvent.change(screen.getByLabelText('Port'), { target: { value: port } });
};

describe('RegisterAgentDialog form', () => {
  it('renders nothing when closed', () => {
    renderDialog({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps submit disabled until name and host are filled', () => {
    renderDialog();
    const submit = screen.getByRole('button', { name: 'Register' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'web-1' } });
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Host'), { target: { value: 'vps1.example' } });
    expect(submit.disabled).toBe(false);
  });

  it('does not dispatch when the form is submitted while invalid', () => {
    renderDialog();
    const form = screen.getByLabelText('Name').closest('form') as HTMLFormElement;
    fireEvent.submit(form);
    expect(mocked.registerAgentRequest).not.toHaveBeenCalled();
  });

  it('does not dispatch again while a registration is in flight', () => {
    renderDialog({}, { registerStatus: 'loading' });
    expect(screen.getByRole('button', { name: 'Registering…' })).toBeDisabled();
    fillForm();
    const form = screen.getByLabelText('Name').closest('form') as HTMLFormElement;
    fireEvent.submit(form);
    expect(mocked.registerAgentRequest).not.toHaveBeenCalled();
  });

  it('registers with a port and swaps the form for the one-time key', async () => {
    mocked.registerAgentRequest.mockResolvedValue(registered);
    renderDialog();
    fillForm('7443');
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    expect(await screen.findByTestId('agent-api-key')).toBeInTheDocument();
    expect(mocked.registerAgentRequest).toHaveBeenCalledWith({
      name: 'web-1',
      host: 'vps1.example',
      port: 7443,
    });
    expect(screen.getByText('dsa_0123456789abcdef01234567.abc')).toBeInTheDocument();
    expect(screen.getByText(/shown once and can never be retrieved again/)).toBeInTheDocument();
    // Registration refreshes the fleet list behind the key dialog.
    expect(mocked.fetchFleetRequest).toHaveBeenCalledTimes(1);
  });

  it('omits the port from the payload when the field is left empty', async () => {
    mocked.registerAgentRequest.mockResolvedValue(registered);
    renderDialog();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    await screen.findByTestId('agent-api-key');
    expect(mocked.registerAgentRequest).toHaveBeenCalledWith({
      name: 'web-1',
      host: 'vps1.example',
    });
  });

  it('surfaces the register error inline on failure', async () => {
    mocked.registerAgentRequest.mockRejectedValue(new Error('name taken'));
    const store = renderDialog();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('name taken');
    expect(store.getState().fleet.registerStatus).toBe('failed');
    expect(screen.queryByTestId('agent-api-key')).not.toBeInTheDocument();
  });

  it('falls back to a generic register error without a message', () => {
    renderDialog({}, { registerStatus: 'failed', registerError: null });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not register the agent.');
  });

  it('cancel resets the register state and closes', () => {
    const onClose = vi.fn();
    const store = renderDialog({ onClose }, { registerStatus: 'failed', registerError: 'x' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(store.getState().fleet.registerStatus).toBe('idle');
    expect(store.getState().fleet.registerError).toBeNull();
  });

  it('Escape closes the dialog', () => {
    // Radix's DismissableLayer listens for Escape on the document.
    const onClose = vi.fn();
    renderDialog({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('RegisterAgentDialog one-time key', () => {
  const registerToKey = async (
    props: Partial<React.ComponentProps<typeof RegisterAgentDialog>> = {},
  ) => {
    mocked.registerAgentRequest.mockResolvedValue(registered);
    renderDialog(props);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    await screen.findByTestId('agent-api-key');
  };

  it('copies the key to the clipboard', async () => {
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    await registerToKey();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith('dsa_0123456789abcdef01234567.abc');
  });

  it('tolerates a missing clipboard API', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    await registerToKey();
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Copy' }))).not.toThrow();
  });

  it('Done closes the dialog', async () => {
    const onClose = vi.fn();
    await registerToKey({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
