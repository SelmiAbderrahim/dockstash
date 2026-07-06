import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { AddProjectScreen } from './AddProjectScreen';
import { projectsReducer, type ProjectsState } from '../store/slice';
import type { Project, ProjectPlan } from '../types';
import { i18n, initI18n } from '@shared/i18n';
import * as api from '../api';
import * as fleet from '@features/fleet';

vi.mock('../api', () => ({
  listProjectsRequest: vi.fn(async () => []),
  discoverFoldersRequest: vi.fn(async () => []),
  discoverContainersRequest: vi.fn(async () => ({ containers: [], dockerAvailable: false })),
  discoverAgentRequest: vi.fn(async () => ({
    folders: [],
    containers: [],
    dockerAvailable: false,
    roots: ['/var/www'],
    snapshotAt: null,
    reported: true,
    errors: [],
  })),
  refreshAgentDiscoveryRequest: vi.fn(async () => undefined),
  scanProjectRequest: vi.fn(async () => ({ paths: [], databases: [], configs: [] })),
  createProjectRequest: vi.fn(async () => ({ id: 'new' })),
  updatePlanRequest: vi.fn(),
  assignProjectAgentRequest: vi.fn(),
  runBackupNowRequest: vi.fn(),
  listSchedulesRequest: vi.fn(),
  createScheduleRequest: vi.fn(),
  updateScheduleRequest: vi.fn(),
}));

vi.mock('@features/fleet', () => ({ listAgentsRequest: vi.fn(async () => []) }));

const mocked = vi.mocked(api);
const mockedFleet = vi.mocked(fleet);

const agent = (over: Partial<fleet.Agent> = {}): fleet.Agent => ({
  id: 'ag1',
  name: 'prod',
  host: '10.0.0.1',
  port: 22,
  status: 'online',
  lastSeenAt: null,
  agentVersion: '0.2.0',
  outdated: false,
  ...over,
});

const baseState: ProjectsState = {
  items: [],
  status: 'idle',
  error: null,
  activeJobByProject: {},
  schedules: [],
  schedulesStatus: 'idle',
  scheduleSaveStatus: 'idle',
  planSaveStatus: 'idle',
  pitr: { resolution: null, status: 'idle', error: null, restoreJobId: null, restoreStatus: 'idle' },
  jobs: [],
  jobsProjectId: null,
  jobsStatus: 'idle',
  jobsError: null,
  alertsSaveStatus: 'idle',
  alertsError: null,
  mirrorSaveStatus: 'idle',
  mirrorError: null,
  folders: [],
  foldersStatus: 'idle',
  containers: [],
  dockerAvailable: false,
  containersStatus: 'idle',
  scannedPlan: null,
  scanStatus: 'idle',
  createStatus: 'idle',
  addError: null,
  agentFolders: [],
  agentContainers: [],
  agentDockerAvailable: false,
  agentRoots: ['/var/www'],
  agentSnapshotAt: null,
  agentDiscoveryStatus: 'idle',
  agentReported: false,
  agentDiscoveryErrors: [],
  agentRefreshStatus: 'idle',
};

const addedProject = (path: string): Project =>
  ({ id: 'x', path, name: 'x', plan: { paths: [], databases: [], configs: [] } } as unknown as Project);

const planWithDb: ProjectPlan = {
  paths: ['/var/www/app'],
  databases: [
    { service: 'db', type: 'postgres', container: 'app_db_1', enabled: true },
    { service: 'cache', type: 'redis', container: 'app_cache_1', enabled: true },
  ],
  configs: ['/var/www/app/traefik'],
};

const makeStore = (over: Partial<ProjectsState> = {}) =>
  configureStore({
    reducer: { projects: projectsReducer },
    preloadedState: { projects: { ...baseState, ...over } },
  });

type Store = ReturnType<typeof makeStore>;

const renderScreen = (store: Store, entry = '/projects/new') => {
  return render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/projects/new" element={<AddProjectScreen />} />
            <Route path="/projects" element={<div>projects-list</div>} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
};

const agentDiscovery = (over: Partial<Awaited<ReturnType<typeof api.discoverAgentRequest>>> = {}) => ({
  folders: [],
  containers: [],
  dockerAvailable: false,
  roots: ['/var/www'],
  snapshotAt: null,
  reported: true,
  errors: [],
  ...over,
});

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
  mocked.discoverFoldersRequest.mockResolvedValue([]);
  mocked.discoverContainersRequest.mockResolvedValue({ containers: [], dockerAvailable: false });
  mocked.discoverAgentRequest.mockResolvedValue(agentDiscovery());
  mocked.scanProjectRequest.mockResolvedValue(planWithDb);
  mocked.createProjectRequest.mockResolvedValue({ id: 'new' } as never);
  mockedFleet.listAgentsRequest.mockResolvedValue([agent()]);
});

describe('AddProjectScreen — fleet target', () => {
  it('auto-selects the first fleet agent and never renders the local server option', async () => {
    mockedFleet.listAgentsRequest.mockResolvedValue([
      agent(),
      agent({ id: 'ag2', name: 'staging', host: '10.0.0.2' }),
    ]);
    renderScreen(makeStore());

    const select = (await screen.findByLabelText('Backup target')) as HTMLSelectElement;
    await waitFor(() => expect(mocked.discoverAgentRequest).toHaveBeenCalledWith('ag1'));

    expect(select.value).toBe('ag1');
    expect(within(select).getAllByRole('option')).toHaveLength(2);
    expect(within(select).queryByRole('option', { name: 'Local server' })).not.toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'prod (10.0.0.1)' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'staging (10.0.0.2)' })).toBeInTheDocument();
  });

  it('shows a fleet registration empty state when there are no agents', async () => {
    mockedFleet.listAgentsRequest.mockResolvedValue([]);
    renderScreen(makeStore());

    expect(await screen.findByTestId('agents-empty')).toBeInTheDocument();
    expect(screen.getByText('No fleet agents registered.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Fleet' })).toHaveAttribute('href', '/fleet');
    expect(screen.queryByRole('tab', { name: /Folders/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Project path')).not.toBeInTheDocument();
    expect(mocked.discoverFoldersRequest).not.toHaveBeenCalled();
    expect(mocked.discoverContainersRequest).not.toHaveBeenCalled();
    expect(mocked.discoverAgentRequest).not.toHaveBeenCalled();
  });

  it('switching the target agent re-runs discovery for the new agent', async () => {
    mockedFleet.listAgentsRequest.mockResolvedValue([
      agent(),
      agent({ id: 'ag2', name: 'staging', host: '10.0.0.2' }),
    ]);
    renderScreen(makeStore());

    await waitFor(() => expect(mocked.discoverAgentRequest).toHaveBeenCalledWith('ag1'));
    fireEvent.change(screen.getByLabelText('Backup target'), { target: { value: 'ag2' } });
    await waitFor(() => expect(mocked.discoverAgentRequest).toHaveBeenCalledWith('ag2'));
  });

  it('shows the registration empty state when the agents request fails', async () => {
    mockedFleet.listAgentsRequest.mockRejectedValue(new Error('boom'));
    renderScreen(makeStore());

    expect(await screen.findByTestId('agents-empty')).toBeInTheDocument();
    expect(mocked.discoverAgentRequest).not.toHaveBeenCalled();
  });

  it('shows an offline badge and disables the folders/docker tabs for an offline agent', async () => {
    mockedFleet.listAgentsRequest.mockResolvedValue([agent({ status: 'offline' })]);
    renderScreen(makeStore());

    await waitFor(() => expect(mocked.discoverAgentRequest).toHaveBeenCalledWith('ag1'));
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Folders/ })).toBeDisabled();
    expect(screen.getByRole('tab', { name: /Running Docker/ })).toBeDisabled();
  });

  it('clicking Refresh dispatches a refresh request for the current agent', async () => {
    renderScreen(makeStore());

    await waitFor(() => expect(mocked.discoverAgentRequest).toHaveBeenCalledWith('ag1'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh now' }));

    await waitFor(() => expect(mocked.refreshAgentDiscoveryRequest).toHaveBeenCalledWith('ag1'));
  });

  it('re-polls discovery a few seconds after a refresh request', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderScreen(makeStore());
      await waitFor(() => expect(mocked.discoverAgentRequest).toHaveBeenCalledWith('ag1'));
      fireEvent.click(screen.getByRole('button', { name: 'Refresh now' }));
      await waitFor(() => expect(mocked.refreshAgentDiscoveryRequest).toHaveBeenCalledWith('ag1'));
      mocked.discoverAgentRequest.mockClear();
      await vi.advanceTimersByTimeAsync(5000);
      await waitFor(() => expect(mocked.discoverAgentRequest).toHaveBeenCalledWith('ag1'));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('AddProjectScreen — agent folders tab', () => {
  it('lists agent folders and marks compose / plain / already-added', async () => {
    mocked.discoverAgentRequest.mockResolvedValue(
      agentDiscovery({
        folders: [
          {
            name: 'app',
            path: '/var/www/app',
            hasCompose: true,
            composeFile: 'docker-compose.yml',
            plan: planWithDb,
          },
          {
            name: 'static',
            path: '/var/www/static',
            hasCompose: false,
            composeFile: null,
            plan: { paths: ['/var/www/static'], databases: [], configs: [] },
          },
          {
            name: 'added',
            path: '/var/www/added',
            hasCompose: true,
            composeFile: 'docker-compose.yml',
            plan: { paths: ['/var/www/added'], databases: [], configs: [] },
          },
        ],
      }),
    );
    const store = makeStore({ items: [addedProject('/var/www/added')] });
    renderScreen(store);

    expect(await screen.findByText('/var/www/app')).toBeInTheDocument();
    expect(screen.getByText('Files only')).toBeInTheDocument();
    expect(screen.getByText('Already added')).toBeInTheDocument();
  });

  it('picks an agent folder, reaches review without local scan, and creates with agentId', async () => {
    mocked.discoverAgentRequest.mockResolvedValue(
      agentDiscovery({
        folders: [
          {
            name: 'app',
            path: '/var/www/app',
            hasCompose: true,
            composeFile: 'docker-compose.yml',
            plan: planWithDb,
          },
        ],
        snapshotAt: '2026-07-03T00:00:00.000Z',
      }),
    );
    renderScreen(makeStore());

    fireEvent.click(await screen.findByRole('button', { name: 'Select' }));
    expect(mocked.scanProjectRequest).not.toHaveBeenCalled();
    expect(await screen.findByText('Review and create')).toBeInTheDocument();
    expect((screen.getByLabelText('Project name') as HTMLInputElement).value).toBe('app');

    fireEvent.change(screen.getByLabelText('Repository password'), {
      target: { value: 'password1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() =>
      expect(mocked.createProjectRequest).toHaveBeenCalledWith({
        name: 'app',
        path: '/var/www/app',
        repoPassword: 'password1',
        plan: planWithDb,
        agentId: 'ag1',
      }),
    );
    expect(await screen.findByText('projects-list')).toBeInTheDocument();
  });

  it('review of a plain folder (files-only plan) shows the no-databases message', async () => {
    mocked.discoverAgentRequest.mockResolvedValue(
      agentDiscovery({
        folders: [
          {
            name: 'plain',
            path: '/var/www/plain',
            hasCompose: false,
            composeFile: null,
            plan: { paths: ['/var/www/plain'], databases: [], configs: [] },
          },
        ],
        snapshotAt: '2026-07-03T00:00:00.000Z',
      }),
    );
    renderScreen(makeStore());

    fireEvent.click(await screen.findByRole('button', { name: 'Select' }));
    expect(await screen.findByText('Review and create')).toBeInTheDocument();
    expect(screen.getByText('None detected.')).toBeInTheDocument();
  });

  it('shows the agent-specific empty-state copy when an agent reports no folders', async () => {
    mocked.discoverAgentRequest.mockResolvedValue(
      agentDiscovery({ snapshotAt: '2026-07-03T00:00:00.000Z' }),
    );
    renderScreen(makeStore());

    const empty = await screen.findByTestId('folders-empty');
    expect(within(empty).getByText(/agent's \/var\/www snapshot is empty/i)).toBeInTheDocument();
    expect(within(empty).queryByText(/No subdirectories under \/var\/www\./)).not.toBeInTheDocument();
  });

  it('shows a discovery error without calling local discovery', async () => {
    mocked.discoverAgentRequest.mockRejectedValue(new Error('snapshot unavailable'));
    renderScreen(makeStore());

    expect(await screen.findByText('snapshot unavailable')).toBeInTheDocument();
    expect(mocked.discoverFoldersRequest).not.toHaveBeenCalled();
    expect(mocked.discoverContainersRequest).not.toHaveBeenCalled();
  });

  it('shows a not-reported alert with a Fleet link when the agent has never heartbeated', async () => {
    mocked.discoverAgentRequest.mockResolvedValue(agentDiscovery({ reported: false }));
    renderScreen(makeStore());

    expect(await screen.findByTestId('agent-not-reported')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View in Fleet' })).toHaveAttribute('href', '/fleet');
    expect(screen.queryByTestId('agent-discovery-errors')).not.toBeInTheDocument();
  });

  it('never shows the misleading folders empty state for a never-reported agent', async () => {
    mocked.discoverAgentRequest.mockResolvedValue(agentDiscovery({ reported: false }));
    renderScreen(makeStore());

    const guidance = await screen.findByTestId('folders-not-reported');
    expect(within(guidance).getByText(/running an outdated image/i)).toBeInTheDocument();
    expect(screen.queryByTestId('folders-empty')).not.toBeInTheDocument();
  });

  it('never shows the misleading docker-unavailable state for a never-reported agent', async () => {
    mocked.discoverAgentRequest.mockResolvedValue(agentDiscovery({ reported: false }));
    renderScreen(makeStore(), '/projects/new?tab=docker');

    expect(await screen.findByTestId('docker-not-reported')).toBeInTheDocument();
    expect(screen.queryByTestId('docker-unavailable')).not.toBeInTheDocument();
    expect(screen.queryByTestId('docker-empty')).not.toBeInTheDocument();
  });

  it('shows discovery errors reported by the agent', async () => {
    mocked.discoverAgentRequest.mockResolvedValue(
      agentDiscovery({
        errors: ['Docker socket is unreachable — check that the docker-socket-proxy is running.'],
      }),
    );
    renderScreen(makeStore());

    const errors = await screen.findByTestId('agent-discovery-errors');
    expect(within(errors).getByText(/Docker socket is unreachable/)).toBeInTheDocument();
    expect(screen.queryByTestId('agent-not-reported')).not.toBeInTheDocument();
  });
});

describe('AddProjectScreen — agent docker tab', () => {
  it('reports agent docker unavailable', async () => {
    renderScreen(makeStore(), '/projects/new?tab=docker');
    expect(await screen.findByTestId('docker-unavailable')).toBeInTheDocument();
  });

  it('shows the agent-reported Docker discovery error when Docker is unavailable', async () => {
    mocked.discoverAgentRequest.mockResolvedValue(
      agentDiscovery({
        dockerAvailable: false,
        errors: [
          'Docker socket is unreachable — check that the docker-socket-proxy container is running and allows CONTAINERS.',
        ],
      }),
    );
    renderScreen(makeStore(), '/projects/new?tab=docker');

    const empty = await screen.findByTestId('docker-unavailable');
    expect(within(empty).getByText(/docker-socket-proxy container is running/)).toBeInTheDocument();
    expect(within(empty).queryByText(/This agent can't reach Docker/)).not.toBeInTheDocument();
  });

  it('lists running compose projects and creates from an addable one without local scan', async () => {
    mocked.discoverAgentRequest.mockResolvedValue(
      agentDiscovery({
        dockerAvailable: true,
        containers: [
          {
            project: 'shop',
            workingDir: '/var/www/shop',
            configFiles: [],
            services: ['db', 'web'],
            containerNames: ['shop_db_1'],
            addable: true,
            standalone: false,
            plan: planWithDb,
          },
          {
            project: 'infra',
            workingDir: '/opt/infra',
            configFiles: [],
            services: [],
            containerNames: ['infra_1'],
            addable: false,
            standalone: false,
            plan: null,
          },
          {
            project: 'lonely',
            workingDir: null,
            configFiles: [],
            services: [],
            containerNames: ['lonely'],
            addable: false,
            standalone: true,
            plan: null,
          },
          {
            project: 'no-dir',
            workingDir: null,
            configFiles: [],
            services: [],
            containerNames: ['no_dir_1'],
            addable: false,
            standalone: false,
            plan: null,
          },
        ],
      }),
    );
    renderScreen(makeStore(), '/projects/new?tab=docker');

    expect(await screen.findByText('shop')).toBeInTheDocument();
    expect(screen.getByText('Standalone')).toBeInTheDocument();
    expect(screen.getByText('Outside agent directories')).toBeInTheDocument();
    expect(screen.getByText('No folder path reported')).toBeInTheDocument();
    const selects = screen.getAllByRole('button', { name: 'Select' });
    const enabled = selects.filter((b) => !(b as HTMLButtonElement).disabled);
    expect(enabled).toHaveLength(1);

    fireEvent.click(enabled[0]!);
    expect(mocked.scanProjectRequest).not.toHaveBeenCalled();
    expect(await screen.findByText('Review and create')).toBeInTheDocument();
  });

  it('falls back to the /var/www allowlist when the server omits roots', async () => {
    mocked.discoverAgentRequest.mockResolvedValue(
      agentDiscovery({
        roots: [],
        dockerAvailable: true,
        containers: [
          {
            project: 'infra',
            workingDir: '/opt/infra',
            configFiles: [],
            services: [],
            containerNames: ['infra_1'],
            addable: false,
            standalone: false,
            plan: null,
          },
        ],
      }),
    );
    renderScreen(makeStore(), '/projects/new?tab=docker');

    // /opt/infra is outside the fallback /var/www root, so the hint shows.
    expect(await screen.findByText('Outside agent directories')).toBeInTheDocument();
  });

  it('shows the docker empty state when available with no containers', async () => {
    mocked.discoverAgentRequest.mockResolvedValue(agentDiscovery({ dockerAvailable: true }));
    renderScreen(makeStore(), '/projects/new?tab=docker');

    expect(await screen.findByTestId('docker-empty')).toBeInTheDocument();
  });

  it('marks an already-added compose project and disables its Select', async () => {
    mocked.discoverAgentRequest.mockResolvedValue(
      agentDiscovery({
        dockerAvailable: true,
        containers: [
          {
            project: 'shop',
            workingDir: '/var/www/shop',
            configFiles: [],
            services: ['db'],
            containerNames: ['shop_db_1'],
            addable: true,
            standalone: false,
            plan: planWithDb,
          },
        ],
      }),
    );
    const store = makeStore({ items: [addedProject('/var/www/shop')] });
    renderScreen(store, '/projects/new?tab=docker');

    expect(await screen.findByText('Already added')).toBeInTheDocument();
    expect((screen.getByRole('button', { name: 'Select' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

describe('AddProjectScreen — review step', () => {
  const openReview = async () => {
    mocked.discoverAgentRequest.mockResolvedValue(
      agentDiscovery({
        folders: [
          {
            name: 'app',
            path: '/var/www/app',
            hasCompose: true,
            composeFile: 'docker-compose.yml',
            plan: planWithDb,
          },
        ],
      }),
    );
    renderScreen(makeStore());
    fireEvent.click(await screen.findByRole('button', { name: 'Select' }));
    await screen.findByText('Review and create');
  };

  it('toggles database and config layers and blocks submit until valid', async () => {
    await openReview();
    const submit = screen.getByRole('button', { name: 'Create project' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByLabelText('db (postgres)'));
    fireEvent.click(screen.getByLabelText('/var/www/app/traefik'));
    fireEvent.click(screen.getByLabelText('/var/www/app/traefik'));
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'renamed' } });
    fireEvent.change(screen.getByLabelText('Repository password'), {
      target: { value: 'password1' },
    });

    expect((screen.getByLabelText('Project name') as HTMLInputElement).value).toBe('renamed');
    expect((submit as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows an error alert when creation fails, staying on the review step', async () => {
    mocked.createProjectRequest.mockRejectedValue(new Error('duplicate project'));
    await openReview();

    fireEvent.change(screen.getByLabelText('Repository password'), {
      target: { value: 'password1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByText('duplicate project')).toBeInTheDocument();
    expect(screen.getByText('Review and create')).toBeInTheDocument();
  });

  it('goes back to the picker', async () => {
    await openReview();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('button', { name: 'Select' })).toBeInTheDocument();
  });
});

describe('AddProjectScreen — tabs', () => {
  it('falls back to the folders tab for invalid or removed tab values', async () => {
    renderScreen(makeStore(), '/projects/new?tab=manual');

    expect(await screen.findByTestId('folders-empty')).toBeInTheDocument();
    expect(screen.queryByLabelText('Project path')).not.toBeInTheDocument();
    await waitFor(() => expect(mocked.discoverAgentRequest).toHaveBeenCalledWith('ag1'));
  });
});
