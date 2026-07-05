import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { ProjectsScreen } from './ProjectsScreen';
import { projectsReducer, type ProjectsState } from '../store/slice';
import type { Project } from '../types';
import { i18n, initI18n } from '@shared/i18n';
import * as api from '../api';

vi.mock('../api', () => ({
  listProjectsRequest: vi.fn(async () => []),
  runBackupNowRequest: vi.fn(async () => 'job-xyz'),
}));

// Stub the log panel so no socket is opened; expose an onDone trigger.
vi.mock('@shared/components/ResticLogPanel', () => ({
  ResticLogPanel: ({ jobId, onDone }: { jobId: string; onDone?: () => void }) => (
    <button type="button" data-testid="log-done" onClick={() => onDone?.()}>
      panel:{jobId}
    </button>
  ),
}));

const mocked = vi.mocked(api);

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
  agentRoots: ['/var/www'],
  agentSnapshotAt: null,
  agentDiscoveryStatus: 'idle',
  agentReported: false,
  agentDiscoveryErrors: [],
  agentRefreshStatus: 'idle',
};

const makeStore = (projects: Partial<ProjectsState> = {}) =>
  configureStore({
    reducer: { projects: projectsReducer },
    preloadedState: { projects: { ...baseState, ...projects } },
  });

type Store = ReturnType<typeof makeStore>;

const renderScreen = (store: Store) => {
  const utils = render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/projects']}>
          <Routes>
            <Route path="/projects" element={<ProjectsScreen />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
  return { store, ...utils };
};

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
});

describe('ProjectsScreen', () => {
  it('fetches projects on mount and shows the empty state with a CTA', async () => {
    mocked.listProjectsRequest.mockResolvedValue([]);
    renderScreen(makeStore());
    await waitFor(() => expect(mocked.listProjectsRequest).toHaveBeenCalled());
    expect(await screen.findByText(/no projects found/i)).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /add your first project/i });
    expect(cta).toHaveAttribute('href', '/projects/new');
  });

  it('always shows the header Add project link', () => {
    mocked.listProjectsRequest.mockReturnValue(new Promise(() => {}));
    renderScreen(makeStore());
    expect(screen.getByRole('link', { name: /add project/i })).toHaveAttribute(
      'href',
      '/projects/new',
    );
  });

  it('shows the loading state while the fetch is pending', () => {
    mocked.listProjectsRequest.mockReturnValue(new Promise(() => {}));
    renderScreen(makeStore());
    expect(screen.getByRole('status')).toHaveTextContent(/loading projects/i);
  });

  it('shows the error state and retries the fetch', async () => {
    mocked.listProjectsRequest.mockRejectedValue(new Error('Down'));
    renderScreen(makeStore());
    expect(await screen.findByRole('alert')).toHaveTextContent('Down');
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() =>
      expect(mocked.listProjectsRequest.mock.calls.length).toBeGreaterThanOrEqual(2),
    );
  });

  it('falls back to the default error message when the error is null', () => {
    // Block thunk dispatches so the crafted failed+null state is not overwritten
    // by the mount fetch (which would always set a non-null error message).
    const store = makeStore({ status: 'failed', error: null });
    const realDispatch = store.dispatch;
    store.dispatch = ((action: unknown) =>
      typeof action === 'function' ? undefined : realDispatch(action as never)) as typeof store.dispatch;
    renderScreen(store);
    expect(screen.getByRole('alert')).toHaveTextContent(/could not load projects/i);
  });

  it('renders a grid of project cards with status labels and last-run dates', async () => {
    mocked.listProjectsRequest.mockResolvedValue([
      baseProject({ id: 'a', name: 'idleP', lastStatus: 'idle' }),
      baseProject({ id: 'b', name: 'runP', lastStatus: 'running' }),
      baseProject({ id: 'c', name: 'okP', lastStatus: 'success' }),
      baseProject({
        id: 'd',
        name: 'failP',
        lastStatus: 'failed',
        lastRunAt: '2026-02-02T10:00:00Z',
      }),
    ]);
    renderScreen(makeStore());
    expect(await screen.findByTestId('projects-grid')).toBeInTheDocument();
    // statusLabel maps each lastStatus to a namespaced key (all four branches).
    expect(screen.getByText('projects.status.idle')).toBeInTheDocument();
    expect(screen.getByText('projects.status.running')).toBeInTheDocument();
    expect(screen.getByText('projects.status.success')).toBeInTheDocument();
    expect(screen.getByText('projects.status.failed')).toBeInTheDocument();
    // The three projects without lastRunAt show the "Never" placeholder.
    expect(screen.getAllByText('Never').length).toBe(3);
  });

  it('runs a backup and disables the button while the job is active', async () => {
    mocked.listProjectsRequest.mockResolvedValue([baseProject({ id: 'p1', name: 'app' })]);
    const { store } = renderScreen(makeStore());
    const button = await screen.findByRole('button', { name: /backup now/i });
    fireEvent.click(button);
    await waitFor(() => expect(store.getState().projects.activeJobByProject.p1).toBe('job-xyz'));
    expect(screen.getByTestId('log-done')).toHaveTextContent('panel:job-xyz');
    expect(screen.getByRole('button', { name: /backup now/i })).toBeDisabled();
  });

  it('clears the active job when the log panel reports done', async () => {
    mocked.listProjectsRequest.mockResolvedValue([baseProject({ id: 'p1' })]);
    const { store } = renderScreen(makeStore({ activeJobByProject: { p1: 'job-1' } }));
    const doneBtn = await screen.findByTestId('log-done');
    fireEvent.click(doneBtn);
    await waitFor(() => expect(store.getState().projects.activeJobByProject.p1).toBeNull());
  });
});
