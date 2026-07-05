import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { configureStore } from '@reduxjs/toolkit';
import { AgentSetupDialog } from './AgentSetupDialog';
import { fleetReducer, type FleetState } from '../store/slice';
import * as api from '../api';
import type { FleetEntry } from '../types';
import { i18n, initI18n } from '@shared/i18n';

vi.mock('../api', () => ({
  listAgentsRequest: vi.fn(),
  registerAgentRequest: vi.fn(),
  fetchFleetRequest: vi.fn(async () => []),
  rotateAgentKeyRequest: vi.fn(),
  deleteAgentRequest: vi.fn(),
}));

const mocked = vi.mocked(api);

const agent: FleetEntry = {
  id: 'a1',
  name: 'web-1',
  host: 'vps1.example',
  status: 'online',
  lastSeenAt: null,
  agentVersion: '0.2.0',
  outdated: false,
  projectCount: 1,
  totalBytes: 10,
  snapshotCount: 2,
};

const rotated = {
  agent: { id: 'a1', name: 'web-1', host: 'vps1.example', port: 22, status: 'online' as const, lastSeenAt: null, agentVersion: '', outdated: false },
  token: 'dsa_0123456789abcdef01234567.new',
};

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
  vi.stubGlobal('location', { origin: 'http://dashboard.example.com' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const renderDialog = (
  props: Partial<React.ComponentProps<typeof AgentSetupDialog>> = {},
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
        <AgentSetupDialog agent={agent} onClose={() => {}} {...props} />
      </I18nextProvider>
    </Provider>,
  );
  return store;
};

describe('AgentSetupDialog', () => {
  it('renders nothing when there is no agent', () => {
    renderDialog({ agent: null });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the placeholder install command and the placeholder note', () => {
    renderDialog();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Agent setup')).toBeInTheDocument();
    expect(screen.getByText(/Replace <AGENT_TOKEN>/)).toBeInTheDocument();
    expect(screen.queryByTestId('agent-api-key')).not.toBeInTheDocument();
  });

  it('updates the install command as project directories change', () => {
    renderDialog();
    const roots = screen.getByLabelText('Project directories');
    fireEvent.change(roots, { target: { value: '/opt/apps' } });
    const command = screen.getByText(/DOCKSTASH_PROJECT_ROOTS/).textContent ?? '';
    expect(command).toContain('DOCKSTASH_PROJECT_ROOTS: /opt/apps');
    expect(command).toContain('- /opt/apps:/opt/apps:rw');
  });

  it('flags invalid project directories inline', () => {
    renderDialog();
    const roots = screen.getByLabelText('Project directories');
    fireEvent.change(roots, { target: { value: '/proc/x' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/\/proc\/x/);
    fireEvent.change(roots, { target: { value: ' , ' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/at least one project directory/i);
  });

  it('disables the rotate trigger while a rotation is in flight', () => {
    renderDialog({}, { rotateStatus: 'loading' });
    expect(screen.getByRole('button', { name: 'Rotating…' })).toBeDisabled();
  });

  it('shows the rotate error inline with a fallback message', () => {
    renderDialog({}, { rotateStatus: 'failed', rotateError: null });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not rotate the agent key.');
  });

  it('shows the specific rotate error when present', () => {
    renderDialog({}, { rotateStatus: 'failed', rotateError: 'agent offline' });
    expect(screen.getByRole('alert')).toHaveTextContent('agent offline');
  });

  it('confirming rotate dispatches rotateAgentKey and swaps to the one-time key reveal', async () => {
    mocked.rotateAgentKeyRequest.mockResolvedValue(rotated);
    const store = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Rotate agent key' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rotate key' }));
    expect(await screen.findByTestId('agent-api-key')).toBeInTheDocument();
    expect(mocked.rotateAgentKeyRequest).toHaveBeenCalledWith('a1');
    expect(screen.getByText('dsa_0123456789abcdef01234567.new')).toBeInTheDocument();
    expect(store.getState().fleet.rotateStatus).toBe('succeeded');
  });

  it('surfaces a failed rotation via the selector-backed error', async () => {
    mocked.rotateAgentKeyRequest.mockRejectedValue(new Error('boom'));
    const store = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Rotate agent key' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rotate key' }));
    await waitFor(() => expect(store.getState().fleet.rotateStatus).toBe('failed'));
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
    expect(screen.queryByTestId('agent-api-key')).not.toBeInTheDocument();
  });

  it('close resets the rotate state and token, and calls onClose', async () => {
    mocked.rotateAgentKeyRequest.mockResolvedValue(rotated);
    const onClose = vi.fn();
    const store = renderDialog({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Rotate agent key' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rotate key' }));
    await screen.findByTestId('agent-api-key');

    // Two "Close" buttons exist: the footer action and the dialog's built-in
    // top-right X (sr-only "Close" label) — the footer one is first in DOM order.
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]!);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(store.getState().fleet.rotateStatus).toBe('idle');
    expect(store.getState().fleet.rotateError).toBeNull();
  });

  it('Escape closes the dialog and resets rotate state', () => {
    const onClose = vi.fn();
    renderDialog({ onClose }, { rotateStatus: 'failed', rotateError: 'x' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
