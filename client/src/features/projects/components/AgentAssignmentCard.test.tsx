import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { configureStore } from '@reduxjs/toolkit';
import { AgentAssignmentCard } from './AgentAssignmentCard';
import { projectsReducer } from '../store/slice';
import * as projectsApi from '../api';
import * as fleet from '@features/fleet';
import type { Agent } from '@features/fleet';
import type { Project } from '../types';
import { i18n, initI18n } from '@shared/i18n';

vi.mock('../api', () => ({
  assignProjectAgentRequest: vi.fn(),
}));

vi.mock('@features/fleet', () => ({
  listAgentsRequest: vi.fn(),
}));

const mockedApi = vi.mocked(projectsApi);
const mockedFleet = vi.mocked(fleet);

const baseProject = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  owner: 'u1',
  agentId: null,
  name: 'app',
  path: '/var/www/app',
  plan: { paths: [], databases: [], configs: [] },
  lastStatus: 'idle',
  lastError: '',
  lastRunAt: null,
  lastCheckAt: null,
  lastCheckStatus: null,
  lastCheckDetail: '',
  lastDrillAt: null,
  lastDrillStatus: null,
  lastDrillDetail: '',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...over,
});

const agents: Agent[] = [
  { id: 'a1', name: 'web-1', host: 'vps1.example', port: 22, status: 'online', lastSeenAt: null },
  { id: 'a2', name: 'db-1', host: 'vps2.example', port: 22, status: 'offline', lastSeenAt: null },
];

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
});

const renderCard = (project: Project = baseProject()) => {
  const store = configureStore({ reducer: { projects: projectsReducer } });
  const utils = render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <AgentAssignmentCard project={project} />
      </I18nextProvider>
    </Provider>,
  );
  return { store, ...utils };
};

describe('AgentAssignmentCard', () => {
  it('renders nothing while agents are still loading', () => {
    mockedFleet.listAgentsRequest.mockReturnValue(new Promise(() => {}));
    renderCard();
    expect(screen.queryByText('Runs on')).not.toBeInTheDocument();
  });

  it('renders nothing when there are no agents', async () => {
    mockedFleet.listAgentsRequest.mockResolvedValue([]);
    renderCard();
    await waitFor(() => expect(mockedFleet.listAgentsRequest).toHaveBeenCalled());
    expect(screen.queryByText('Runs on')).not.toBeInTheDocument();
  });

  it('renders nothing when listAgentsRequest rejects (locked / offline)', async () => {
    mockedFleet.listAgentsRequest.mockRejectedValue(new Error('locked'));
    renderCard();
    await waitFor(() => expect(mockedFleet.listAgentsRequest).toHaveBeenCalled());
    expect(screen.queryByText('Runs on')).not.toBeInTheDocument();
  });

  it('renders the card with a "This server (local)" option plus one per agent, offline suffixed', async () => {
    mockedFleet.listAgentsRequest.mockResolvedValue(agents);
    renderCard();
    expect(await screen.findByText('Runs on')).toBeInTheDocument();
    const trigger = screen.getByRole('combobox', { name: 'Backup agent' });
    expect(trigger).toHaveTextContent('This server (local)');

    const user = userEvent.setup();
    await user.click(trigger);
    expect(await screen.findByRole('option', { name: 'This server (local)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'web-1 — vps1.example' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'db-1 — vps2.example (offline)' })).toBeInTheDocument();
  });

  it('shows the assigned agent as the selected value', async () => {
    mockedFleet.listAgentsRequest.mockResolvedValue(agents);
    renderCard(baseProject({ agentId: 'a1' }));
    const trigger = await screen.findByRole('combobox', { name: 'Backup agent' });
    expect(trigger).toHaveTextContent('web-1 — vps1.example');
  });

  it('assigns an agent, showing saving then saved feedback', async () => {
    mockedFleet.listAgentsRequest.mockResolvedValue(agents);
    let resolveAssign!: (project: Project) => void;
    mockedApi.assignProjectAgentRequest.mockReturnValue(
      new Promise((resolve) => {
        resolveAssign = resolve;
      }),
    );
    renderCard();
    const trigger = await screen.findByRole('combobox', { name: 'Backup agent' });

    const user = userEvent.setup();
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: 'web-1 — vps1.example' }));

    expect(await screen.findByText('Saving…')).toBeInTheDocument();
    resolveAssign(baseProject({ agentId: 'a1' }));
    expect(await screen.findByText('Assignment saved.')).toBeInTheDocument();
    expect(mockedApi.assignProjectAgentRequest).toHaveBeenCalledWith('p1', 'a1');
  });

  it('assigns local (null) when the local sentinel is chosen', async () => {
    mockedFleet.listAgentsRequest.mockResolvedValue(agents);
    mockedApi.assignProjectAgentRequest.mockResolvedValue(baseProject());
    renderCard(baseProject({ agentId: 'a1' }));
    const trigger = await screen.findByRole('combobox', { name: 'Backup agent' });

    const user = userEvent.setup();
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: 'This server (local)' }));

    await waitFor(() =>
      expect(mockedApi.assignProjectAgentRequest).toHaveBeenCalledWith('p1', null),
    );
  });

  it('shows an inline error and does not update the project on failure', async () => {
    mockedFleet.listAgentsRequest.mockResolvedValue(agents);
    mockedApi.assignProjectAgentRequest.mockRejectedValue(new Error('boom'));
    renderCard();
    const trigger = await screen.findByRole('combobox', { name: 'Backup agent' });

    const user = userEvent.setup();
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: 'web-1 — vps1.example' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not assign the agent.');
    expect(trigger).toHaveTextContent('This server (local)');
  });
});
