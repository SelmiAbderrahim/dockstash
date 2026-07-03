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
    snapshotAt: null,
  })),
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
const agent = (over: Partial<fleet.Agent> = {}): fleet.Agent =>
  ({ id: 'ag1', name: 'prod', host: '10.0.0.1', port: 22, status: 'online', lastSeenAt: null, ...over });

const baseState: ProjectsState = {
  items: [],
  status: 'idle',
  error: null,
  activeJobByProject: {},
  schedules: [],
  schedulesStatus: 'idle',
  scheduleSaveStatus: 'idle',
  planSaveStatus: 'idle',
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
  agentSnapshotAt: null,
  agentDiscoveryStatus: 'idle',
};

const addedProject = (path: string): Project =>
  ({ id: 'x', path, name: 'x', plan: { paths: [], databases: [], configs: [] } } as unknown as Project);

const planWithDb: ProjectPlan = {
  paths: ['/var/www/app'],
  databases: [
    { service: 'db', type: 'postgres', container: 'app_db_1', enabled: true },
    { service: 'cache', type: 'redis', container: 'app_cache_1', enabled: true },
  ],
  configs: ['/etc/traefik'],
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

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
  mocked.discoverFoldersRequest.mockResolvedValue([]);
  mocked.discoverContainersRequest.mockResolvedValue({ containers: [], dockerAvailable: false });
  mocked.scanProjectRequest.mockResolvedValue(planWithDb);
  mocked.createProjectRequest.mockResolvedValue({ id: 'new' } as never);
  mockedFleet.listAgentsRequest.mockResolvedValue([]);
  mocked.discoverAgentRequest.mockResolvedValue({
    folders: [],
    containers: [],
    dockerAvailable: false,
    snapshotAt: null,
  });
});

describe('AddProjectScreen — folders tab', () => {
  it('lists folders and marks compose / plain / already-added', async () => {
    mocked.discoverFoldersRequest.mockResolvedValue([
      { name: 'app', path: '/var/www/app', hasCompose: true, composeFile: 'docker-compose.yml' },
      { name: 'static', path: '/var/www/static', hasCompose: false, composeFile: null },
      { name: 'added', path: '/var/www/added', hasCompose: true, composeFile: 'docker-compose.yml' },
    ]);
    const store = makeStore({ items: [addedProject('/var/www/added')] });
    renderScreen(store);
    expect(await screen.findByText('/var/www/app')).toBeInTheDocument();
    expect(screen.getByText('Files only')).toBeInTheDocument();
    expect(screen.getByText('Already added')).toBeInTheDocument();
    // The added folder's Select button is disabled.
    const addedRow = screen.getByText('/var/www/added').closest('div')!;
    expect(addedRow).toBeInTheDocument();
  });

  it('picks a compose folder → scans → reaches the review step and creates', async () => {
    mocked.discoverFoldersRequest.mockResolvedValue([
      { name: 'app', path: '/var/www/app', hasCompose: true, composeFile: 'docker-compose.yml' },
    ]);
    renderScreen(makeStore());
    fireEvent.click(await screen.findByRole('button', { name: 'Select' }));
    await waitFor(() => expect(mocked.scanProjectRequest).toHaveBeenCalledWith('/var/www/app'));
    // Review step
    expect(await screen.findByText('Review and create')).toBeInTheDocument();
    const name = screen.getByLabelText('Project name');
    expect((name as HTMLInputElement).value).toBe('app');
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
        agentId: null,
      }),
    );
    expect(await screen.findByText('projects-list')).toBeInTheDocument();
  });

  it('picks a plain folder → review with a files-only plan (no scan)', async () => {
    mocked.discoverFoldersRequest.mockResolvedValue([
      { name: 'static', path: '/var/www/static', hasCompose: false, composeFile: null },
    ]);
    renderScreen(makeStore());
    fireEvent.click(await screen.findByRole('button', { name: 'Select' }));
    expect(await screen.findByText('Review and create')).toBeInTheDocument();
    expect(mocked.scanProjectRequest).not.toHaveBeenCalled();
    expect(screen.getByText('None detected.')).toBeInTheDocument();
  });

  it('shows the empty state when no folders exist', async () => {
    mocked.discoverFoldersRequest.mockResolvedValue([]);
    renderScreen(makeStore());
    expect(await screen.findByTestId('folders-empty')).toBeInTheDocument();
  });

  it('shows an error alert when discovery fails', async () => {
    mocked.discoverFoldersRequest.mockRejectedValue(new Error('EACCES'));
    renderScreen(makeStore());
    expect(await screen.findByText('EACCES')).toBeInTheDocument();
  });
});

describe('AddProjectScreen — docker tab', () => {
  it('reports docker unavailable', async () => {
    renderScreen(makeStore(), '/projects/new?tab=docker');
    expect(await screen.findByTestId('docker-unavailable')).toBeInTheDocument();
  });

  it('lists running compose projects and creates from an addable one', async () => {
    mocked.discoverContainersRequest.mockResolvedValue({
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
        },
        {
          project: 'infra',
          workingDir: '/opt/infra',
          configFiles: [],
          services: [],
          containerNames: ['infra_1'],
          addable: false,
          standalone: false,
        },
        {
          project: 'lonely',
          workingDir: null,
          configFiles: [],
          services: [],
          containerNames: ['lonely'],
          addable: false,
          standalone: true,
        },
      ],
    });
    renderScreen(makeStore(), '/projects/new?tab=docker');
    expect(await screen.findByText('shop')).toBeInTheDocument();
    expect(screen.getByText('Standalone')).toBeInTheDocument();
    expect(screen.getByText('Outside /var/www')).toBeInTheDocument();
    // Only the addable project has an enabled Select.
    const selects = screen.getAllByRole('button', { name: 'Select' });
    const enabled = selects.filter((b) => !(b as HTMLButtonElement).disabled);
    expect(enabled).toHaveLength(1);
    fireEvent.click(enabled[0]!);
    await waitFor(() => expect(mocked.scanProjectRequest).toHaveBeenCalledWith('/var/www/shop'));
    expect(await screen.findByText('Review and create')).toBeInTheDocument();
  });

  it('shows the docker empty state when available with no containers', async () => {
    mocked.discoverContainersRequest.mockResolvedValue({ dockerAvailable: true, containers: [] });
    renderScreen(makeStore(), '/projects/new?tab=docker');
    expect(await screen.findByTestId('docker-empty')).toBeInTheDocument();
  });

  it('marks an already-added compose project and disables its Select', async () => {
    mocked.discoverContainersRequest.mockResolvedValue({
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
        },
      ],
    });
    const store = makeStore({ items: [addedProject('/var/www/shop')] });
    renderScreen(store, '/projects/new?tab=docker');
    expect(await screen.findByText('Already added')).toBeInTheDocument();
    expect((screen.getByRole('button', { name: 'Select' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

describe('AddProjectScreen — manual tab', () => {
  it('scans a typed path then reviews', async () => {
    renderScreen(makeStore(), '/projects/new?tab=manual');
    fireEvent.change(await screen.findByLabelText('Project path'), {
      target: { value: '/var/www/manual-app' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }));
    await waitFor(() =>
      expect(mocked.scanProjectRequest).toHaveBeenCalledWith('/var/www/manual-app'),
    );
    expect(await screen.findByText('Review and create')).toBeInTheDocument();
    expect((screen.getByLabelText('Project name') as HTMLInputElement).value).toBe('manual-app');
  });

  it('derives a fallback name from a slash-only path', async () => {
    renderScreen(makeStore(), '/projects/new?tab=manual');
    fireEvent.change(await screen.findByLabelText('Project path'), {
      target: { value: '/' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }));
    await waitFor(() => expect(mocked.scanProjectRequest).toHaveBeenCalledWith('/'));
    expect((screen.getByLabelText('Project name') as HTMLInputElement).value).toBe('/');
  });

  it('surfaces a scan error without reaching review', async () => {
    mocked.scanProjectRequest.mockRejectedValue(new Error('docker-compose.yml not found'));
    renderScreen(makeStore(), '/projects/new?tab=manual');
    fireEvent.change(await screen.findByLabelText('Project path'), {
      target: { value: '/var/www/broken' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }));
    expect(await screen.findByText('docker-compose.yml not found')).toBeInTheDocument();
    expect(screen.queryByText('Review and create')).toBeNull();
  });
});

describe('AddProjectScreen — review step', () => {
  const openReview = async () => {
    mocked.discoverFoldersRequest.mockResolvedValue([
      { name: 'app', path: '/var/www/app', hasCompose: true, composeFile: 'docker-compose.yml' },
    ]);
    renderScreen(makeStore());
    fireEvent.click(await screen.findByRole('button', { name: 'Select' }));
    await screen.findByText('Review and create');
  };

  it('toggles database and config layers and blocks submit until valid', async () => {
    await openReview();
    const submit = screen.getByRole('button', { name: 'Create project' });
    // Password too short → disabled.
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('db (postgres)'));
    // Toggle the config off, then back on (exercises both ternary arms).
    fireEvent.click(screen.getByLabelText('/etc/traefik'));
    fireEvent.click(screen.getByLabelText('/etc/traefik'));
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
    // Still on the review step (not navigated away).
    expect(screen.getByText('Review and create')).toBeInTheDocument();
  });

  it('goes back to the picker', async () => {
    await openReview();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('button', { name: 'Select' })).toBeInTheDocument();
  });
});

describe('AddProjectScreen — tabs', () => {
  it('falls back to the folders tab for an invalid ?tab=', async () => {
    renderScreen(makeStore(), '/projects/new?tab=bogus');
    // Folders discovery runs for the default tab.
    await waitFor(() => expect(mocked.discoverFoldersRequest).toHaveBeenCalled());
  });
});

describe('AddProjectScreen — fleet target', () => {
  it('shows only the Local option when there are no agents', async () => {
    renderScreen(makeStore());
    const select = (await screen.findByLabelText('Backup target')) as HTMLSelectElement;
    expect(select.value).toBe('local');
    expect(within(select).getAllByRole('option')).toHaveLength(1);
  });

  it('browses a fleet agent snapshot: folder → review without scan, creates with agentId', async () => {
    mockedFleet.listAgentsRequest.mockResolvedValue([agent()]);
    mocked.discoverAgentRequest.mockResolvedValue({
      folders: [
        {
          name: 'shop',
          path: '/var/www/shop',
          hasCompose: true,
          composeFile: 'docker-compose.yml',
          plan: planWithDb,
        },
      ],
      containers: [],
      dockerAvailable: false,
      snapshotAt: '2026-07-03T00:00:00.000Z',
    });
    renderScreen(makeStore());
    await screen.findByRole('option', { name: /prod/ });
    fireEvent.change(screen.getByLabelText('Backup target'), { target: { value: 'ag1' } });
    await waitFor(() => expect(mocked.discoverAgentRequest).toHaveBeenCalledWith('ag1'));
    expect(screen.getByText(/Last reported/)).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Select' }));
    expect(await screen.findByText('Review and create')).toBeInTheDocument();
    expect(mocked.scanProjectRequest).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Repository password'), {
      target: { value: 'password1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() =>
      expect(mocked.createProjectRequest).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: 'ag1', path: '/var/www/shop' }),
      ),
    );
    expect(await screen.findByText('projects-list')).toBeInTheDocument();
  });

  it('browses an agent container group → review with the derived plan (no scan), shows no-snapshot hint', async () => {
    mockedFleet.listAgentsRequest.mockResolvedValue([agent()]);
    mocked.discoverAgentRequest.mockResolvedValue({
      folders: [],
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
      dockerAvailable: true,
      snapshotAt: null,
    });
    renderScreen(makeStore(), '/projects/new?tab=docker');
    await screen.findByRole('option', { name: /prod/ });
    fireEvent.change(screen.getByLabelText('Backup target'), { target: { value: 'ag1' } });
    await waitFor(() => expect(mocked.discoverAgentRequest).toHaveBeenCalled());
    expect(screen.getByText(/hasn't reported yet/)).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Select' }));
    expect(await screen.findByText('Review and create')).toBeInTheDocument();
    expect(mocked.scanProjectRequest).not.toHaveBeenCalled();
  });

  it('shows agent-specific empty-state copy (not the local /var/www wording) when an agent reports no folders', async () => {
    mockedFleet.listAgentsRequest.mockResolvedValue([agent()]);
    mocked.discoverAgentRequest.mockResolvedValue({
      folders: [],
      containers: [],
      dockerAvailable: false,
      snapshotAt: '2026-07-03T00:00:00.000Z',
    });
    renderScreen(makeStore());
    await screen.findByRole('option', { name: /prod/ });
    fireEvent.change(screen.getByLabelText('Backup target'), { target: { value: 'ag1' } });
    await waitFor(() => expect(mocked.discoverAgentRequest).toHaveBeenCalledWith('ag1'));

    const empty = await screen.findByTestId('folders-empty');
    // Agent-aware hint, NOT the local-host "on this server / No subdirectories" copy.
    expect(within(empty).getByText(/this agent reported no projects/i)).toBeInTheDocument();
    expect(within(empty).queryByText(/No subdirectories under \/var\/www\./)).not.toBeInTheDocument();
  });
});
