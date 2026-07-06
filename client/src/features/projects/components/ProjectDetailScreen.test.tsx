import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { ProjectDetailScreen } from './ProjectDetailScreen';
import { projectsReducer, type ProjectsState } from '../store/slice';
import type { Project, Schedule } from '../types';
import { i18n, initI18n } from '@shared/i18n';
import * as api from '../api';

vi.mock('../api', () => ({
  listProjectsRequest: vi.fn(async () => []),
  listSchedulesRequest: vi.fn(async () => []),
  updatePlanRequest: vi.fn(async () => ({})),
  createScheduleRequest: vi.fn(async () => ({})),
  updateScheduleRequest: vi.fn(async () => ({})),
  resolvePitrRequest: vi.fn(async () => ({})),
  pitrRestoreRequest: vi.fn(async () => 'j-9'),
  updateAlertsRequest: vi.fn(async () => ({})),
  updateMirrorRequest: vi.fn(async () => ({})),
}));

// Stub the log panel so no socket is opened; expose an onDone trigger.
vi.mock('@shared/components/ResticLogPanel', () => ({
  ResticLogPanel: ({ jobId, onDone }: { jobId: string; onDone?: (ok: boolean) => void }) => (
    <button type="button" data-testid="log-done" onClick={() => onDone?.(true)}>
      panel:{jobId}
    </button>
  ),
}));

// AgentAssignmentCard self-gates on the fleet: it renders nothing once
// listAgentsRequest rejects (no agents / entitlement-locked), which keeps
// this shell's tests focused on the plan/schedule/drill tabs.
vi.mock('@features/fleet', () => ({
  listAgentsRequest: vi.fn(async () => {
    throw new Error('no fleet');
  }),
}));

const mocked = vi.mocked(api);

const baseProject = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  owner: 'u1',
  agentId: null,
  name: 'app',
  path: '/var/www/app',
  plan: { paths: [], databases: [], configs: [] },
  alertWebhookUrl: '',
  mirror: { enabled: false, sourcePath: '', targetPath: '' },
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

const schedule = (over: Partial<Schedule> = {}): Schedule => ({
  id: 's1',
  projectId: 'p1',
  kind: 'backup',
  cron: '0 5 * * *',
  enabled: true,
  retention: { keepDaily: 7, keepWeekly: 4, keepMonthly: 6, keepHourly: 0, keepLast: 0 },
  createdAt: '',
  updatedAt: '',
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

const makeStore = (projects: Partial<ProjectsState> = {}) =>
  configureStore({
    reducer: { projects: projectsReducer },
    preloadedState: { projects: { ...baseState, ...projects } },
  });

const renderDetail = (
  { projects = {}, entry = '/projects/p1' }: { projects?: Partial<ProjectsState>; entry?: string } = {},
) => {
  // The screen always refetches projects on mount; default that refetch to
  // return the preloaded items so it's a no-op for tests that don't care.
  if (projects.items) mocked.listProjectsRequest.mockResolvedValue(projects.items);
  const store = makeStore(projects);
  const utils = render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/projects/:projectId" element={<ProjectDetailScreen />} />
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
  mocked.listProjectsRequest.mockResolvedValue([]);
  mocked.listSchedulesRequest.mockResolvedValue([]);
});

describe('ProjectDetailScreen shell', () => {
  it('shows a loading state and fetches when the project is missing', async () => {
    renderDetail({ entry: '/projects/missing' });
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    await waitFor(() => expect(mocked.listProjectsRequest).toHaveBeenCalled());
    expect(mocked.listSchedulesRequest).toHaveBeenCalled();
  });

  it('renders the header and switches tabs', async () => {
    // Radix Tabs activate on focus, so drive tab switches with user-event.
    const user = userEvent.setup();
    renderDetail({ projects: { items: [baseProject()] } });
    // Always refetch on mount so status/error reflect current DB, even when the
    // project is already in the store (prevents a stale failure banner).
    await waitFor(() => expect(mocked.listSchedulesRequest).toHaveBeenCalled());
    expect(mocked.listProjectsRequest).toHaveBeenCalled();

    expect(screen.getByRole('heading', { name: 'app' })).toBeInTheDocument();
    // Default tab is plan.
    expect(screen.getByRole('button', { name: /save plan/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /schedule/i }));
    expect(await screen.findByRole('button', { name: /save schedule/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /restore drill/i }));
    expect(await screen.findByRole('heading', { name: /restore drill/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /point-in-time/i }));
    expect(
      await screen.findByRole('heading', { name: /point-in-time restore/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /mirror/i }));
    expect(await screen.findByRole('button', { name: /save mirror/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /alerts/i }));
    expect(await screen.findByRole('button', { name: /save alerts/i })).toBeInTheDocument();
  });

  it('surfaces the last backup failure reason when the project is failed', async () => {
    renderDetail({
      projects: {
        items: [
          baseProject({
            lastStatus: 'failed',
            lastError: 'restic dump failed: /data/dump.rdb does not exist, skipping',
          }),
        ],
      },
    });
    const banner = await screen.findByTestId('last-failure');
    expect(within(banner).getByText(/Last backup failed/i)).toBeInTheDocument();
    expect(
      within(banner).getByText(/\/data\/dump\.rdb does not exist/),
    ).toBeInTheDocument();
  });

  it('shows no failure banner for a healthy project (or a failed one with no error text)', async () => {
    renderDetail({ projects: { items: [baseProject({ lastStatus: 'success' })] } });
    await waitFor(() => expect(mocked.listSchedulesRequest).toHaveBeenCalled());
    expect(screen.queryByTestId('last-failure')).not.toBeInTheDocument();
  });
});

describe('PlanEditor', () => {
  it('shows empty states when the plan has no entries', () => {
    renderDetail({ projects: { items: [baseProject()] } });
    expect(screen.getByText(/no file paths detected/i)).toBeInTheDocument();
    expect(screen.getByText(/no databases detected/i)).toBeInTheDocument();
    expect(screen.getByText(/no config files detected/i)).toBeInTheDocument();
  });

  it('toggles paths, databases and configs then saves the plan', async () => {
    const project = baseProject({
      plan: {
        paths: ['/var/www/app', '/var/www/app/data'],
        databases: [
          { service: 'pg', type: 'postgres', container: 'c1', enabled: true },
          { service: 'redis', type: 'redis', container: 'c2', enabled: false },
        ],
        configs: ['/etc/nginx.conf'],
      },
    });
    renderDetail({ projects: { items: [project] } });

    const pathBox = screen.getByLabelText('/var/www/app') as HTMLInputElement;
    expect(pathBox.checked).toBe(true);
    fireEvent.click(pathBox); // remove branch
    expect((screen.getByLabelText('/var/www/app') as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByLabelText('/var/www/app')); // add branch
    expect((screen.getByLabelText('/var/www/app') as HTMLInputElement).checked).toBe(true);

    const dbBox = screen.getByLabelText('pg (postgres)') as HTMLInputElement;
    fireEvent.click(dbBox);
    expect((screen.getByLabelText('pg (postgres)') as HTMLInputElement).checked).toBe(false);

    const cfgBox = screen.getByLabelText('/etc/nginx.conf') as HTMLInputElement;
    fireEvent.click(cfgBox); // remove
    fireEvent.click(screen.getByLabelText('/etc/nginx.conf')); // add

    fireEvent.click(screen.getByRole('button', { name: /save plan/i }));
    await waitFor(() => expect(mocked.updatePlanRequest).toHaveBeenCalled());
  });

  it('reflects the saving state', () => {
    renderDetail({ projects: { items: [baseProject()], planSaveStatus: 'loading' } });
    const btn = screen.getByRole('button', { name: /saving/i });
    expect(btn).toBeDisabled();
  });

  it('shows the saved confirmation', () => {
    renderDetail({ projects: { items: [baseProject()], planSaveStatus: 'succeeded' } });
    expect(screen.getByText(/plan saved/i)).toBeInTheDocument();
  });
});

describe('ScheduleEditor', () => {
  it('creates a schedule from the default preset', async () => {
    renderDetail({ projects: { items: [baseProject()] }, entry: '/projects/p1?tab=schedule' });
    fireEvent.click(screen.getByRole('button', { name: /save schedule/i }));
    await waitFor(() =>
      expect(mocked.createScheduleRequest).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'p1', cron: '0 3 * * *' }),
      ),
    );
  });

  it('switches presets and rejects an invalid custom cron', async () => {
    renderDetail({ projects: { items: [baseProject()] }, entry: '/projects/p1?tab=schedule' });

    // weekly preset writes its cron value
    fireEvent.click(screen.getByRole('radio', { name: /weekly/i }));
    expect((screen.getByLabelText(/cron expression/i) as HTMLInputElement).value).toBe('0 3 * * 0');

    // custom cron makes the field editable
    fireEvent.click(screen.getByRole('radio', { name: /custom cron/i }));
    const input = screen.getByLabelText(/cron expression/i);
    fireEvent.change(input, { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: /save schedule/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(mocked.createScheduleRequest).not.toHaveBeenCalled();

    // back to daily
    fireEvent.click(screen.getByRole('radio', { name: /daily/i }));
    expect((screen.getByLabelText(/cron expression/i) as HTMLInputElement).value).toBe('0 3 * * *');
  });

  it('applies the continuous preset cron', () => {
    renderDetail({ projects: { items: [baseProject()] }, entry: '/projects/p1?tab=schedule' });
    fireEvent.click(screen.getByRole('radio', { name: /continuous/i }));
    expect((screen.getByLabelText(/cron expression/i) as HTMLInputElement).value).toBe(
      '*/5 * * * *',
    );
  });

  it('populates from and updates an existing schedule', async () => {
    // The mount fetch must resolve to the same schedule so it is not wiped.
    mocked.listSchedulesRequest.mockResolvedValue([schedule({ cron: '0 5 * * *' })]);
    renderDetail({
      projects: { items: [baseProject()], schedules: [schedule({ cron: '0 5 * * *' })] },
      entry: '/projects/p1?tab=schedule',
    });
    const input = screen.getByLabelText(/cron expression/i) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('0 5 * * *'));

    fireEvent.click(screen.getByRole('button', { name: /save schedule/i }));
    await waitFor(() =>
      expect(mocked.updateScheduleRequest).toHaveBeenCalledWith('s1', {
        cron: '0 5 * * *',
        enabled: true,
      }),
    );
  });

  it('reflects the saving and saved states', () => {
    const { rerender } = render(
      <Provider store={makeStore({ items: [baseProject()], scheduleSaveStatus: 'loading' })}>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={['/projects/p1?tab=schedule']}>
            <Routes>
              <Route path="/projects/:projectId" element={<ProjectDetailScreen />} />
            </Routes>
          </MemoryRouter>
        </I18nextProvider>
      </Provider>,
    );
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();

    rerender(
      <Provider store={makeStore({ items: [baseProject()], scheduleSaveStatus: 'succeeded' })}>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={['/projects/p1?tab=schedule']}>
            <Routes>
              <Route path="/projects/:projectId" element={<ProjectDetailScreen />} />
            </Routes>
          </MemoryRouter>
        </I18nextProvider>
      </Provider>,
    );
    expect(screen.getByText(/schedule saved/i)).toBeInTheDocument();
  });
});

describe('DrillStatus', () => {
  it('shows the empty drill message', () => {
    renderDetail({
      projects: { items: [baseProject({ lastDrillAt: null })] },
      entry: '/projects/p1?tab=drill',
    });
    expect(screen.getByText(/no drill has ever run/i)).toBeInTheDocument();
  });

  it('shows a passing drill with its detail', () => {
    renderDetail({
      projects: {
        items: [
          baseProject({
            lastDrillAt: '2026-03-03T09:00:00Z',
            lastDrillStatus: 'pass',
            lastDrillDetail: 'restore verified',
          }),
        ],
      },
      entry: '/projects/p1?tab=drill',
    });
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('restore verified')).toBeInTheDocument();
  });

  it('shows a failed drill when the status is missing', () => {
    renderDetail({
      projects: {
        items: [baseProject({ lastDrillAt: '2026-03-03T09:00:00Z', lastDrillStatus: null })],
      },
      entry: '/projects/p1?tab=drill',
    });
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });
});

const pitrResolution = {
  target: '2026-07-01T10:00:00.000Z',
  gapSeconds: 180,
  snapshot: { id: 'snap1', time: '2026-07-01T09:57:00.000Z' },
};

describe('PitrPanel', () => {
  it('resolves a point in time, restores to a target path and clears on done', async () => {
    mocked.resolvePitrRequest.mockResolvedValue(pitrResolution);
    renderDetail({ projects: { items: [baseProject()] }, entry: '/projects/p1?tab=pitr' });
    await waitFor(() => expect(mocked.listSchedulesRequest).toHaveBeenCalled());

    expect(screen.getByText(/no snapshot resolved yet/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/restore to moment/i), {
      target: { value: '2026-07-01T10:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: /resolve snapshot/i }));
    await waitFor(() =>
      expect(mocked.resolvePitrRequest).toHaveBeenCalledWith(
        'p1',
        new Date('2026-07-01T10:00').toISOString(),
      ),
    );

    expect(await screen.findByText('snap1')).toBeInTheDocument();
    expect(screen.getByText(/3 minutes before your target/i)).toBeInTheDocument();

    // Overwrite is unchecked by default, so a target path is required.
    fireEvent.change(screen.getByLabelText(/restore to path/i), {
      target: { value: '/restore/here' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^restore$/i }));
    await waitFor(() =>
      expect(mocked.pitrRestoreRequest).toHaveBeenCalledWith({
        projectId: 'p1',
        snapshotId: 'snap1',
        overwrite: false,
        targetPath: '/restore/here',
      }),
    );

    expect(await screen.findByTestId('log-done')).toHaveTextContent('panel:j-9');
    expect(screen.getByText(/restore started/i)).toBeInTheDocument();

    // The log panel's onDone resets the whole pitr flow.
    fireEvent.click(screen.getByTestId('log-done'));
    await waitFor(() => expect(screen.queryByTestId('log-done')).not.toBeInTheDocument());
    expect(screen.getByText(/no snapshot resolved yet/i)).toBeInTheDocument();
  });

  it('hides the target path and overwrites in place when the checkbox is ticked', async () => {
    mocked.resolvePitrRequest.mockResolvedValue(pitrResolution);
    renderDetail({ projects: { items: [baseProject()] }, entry: '/projects/p1?tab=pitr' });

    fireEvent.change(screen.getByLabelText(/restore to moment/i), {
      target: { value: '2026-07-01T10:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: /resolve snapshot/i }));
    await screen.findByText('snap1');

    fireEvent.click(screen.getByLabelText(/overwrite the original location/i));
    expect(screen.queryByLabelText(/restore to path/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^restore$/i }));
    await waitFor(() =>
      expect(mocked.pitrRestoreRequest).toHaveBeenCalledWith({
        projectId: 'p1',
        snapshotId: 'snap1',
        overwrite: true,
        targetPath: undefined,
      }),
    );
  });

  it('surfaces a resolve failure (e.g. no snapshot or plan-locked)', async () => {
    mocked.resolvePitrRequest.mockRejectedValue(new Error('pitrLocked'));
    renderDetail({ projects: { items: [baseProject()] }, entry: '/projects/p1?tab=pitr' });

    fireEvent.change(screen.getByLabelText(/restore to moment/i), {
      target: { value: '2026-07-01T10:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: /resolve snapshot/i }));
    expect(await screen.findByText('pitrLocked')).toBeInTheDocument();
    expect(screen.queryByText(/no snapshot resolved yet/i)).not.toBeInTheDocument();
  });

  it('reflects the resolving state', () => {
    renderDetail({
      projects: {
        items: [baseProject()],
        pitr: {
          resolution: null,
          status: 'loading',
          error: null,
          restoreJobId: null,
          restoreStatus: 'idle',
        },
      },
      entry: '/projects/p1?tab=pitr',
    });
    expect(screen.getByRole('button', { name: /resolving/i })).toBeDisabled();
    expect(screen.queryByText(/no snapshot resolved yet/i)).not.toBeInTheDocument();
  });

  it('reflects the restoring state', () => {
    renderDetail({
      projects: {
        items: [baseProject()],
        pitr: {
          resolution: pitrResolution,
          status: 'succeeded',
          error: null,
          restoreJobId: null,
          restoreStatus: 'loading',
        },
      },
      entry: '/projects/p1?tab=pitr',
    });
    expect(screen.getByRole('button', { name: /restoring/i })).toBeDisabled();
  });
});

describe('MirrorEditor', () => {
  it('prefills from the project and saves the mirror settings', async () => {
    const current = baseProject({
      mirror: { enabled: false, sourcePath: '/old', targetPath: '' },
    });
    mocked.updateMirrorRequest.mockResolvedValue(
      baseProject({ mirror: { enabled: true, sourcePath: '/src', targetPath: '/dst' } }),
    );
    renderDetail({ projects: { items: [current] }, entry: '/projects/p1?tab=mirror' });
    await waitFor(() => expect(mocked.listSchedulesRequest).toHaveBeenCalled());

    const src = screen.getByLabelText(/source path/i) as HTMLInputElement;
    expect(src.value).toBe('/old');

    fireEvent.click(screen.getByLabelText(/enabled/i));
    fireEvent.change(src, { target: { value: '/src' } });
    fireEvent.change(screen.getByLabelText(/target path/i), { target: { value: '/dst' } });
    fireEvent.click(screen.getByRole('button', { name: /save mirror/i }));
    await waitFor(() =>
      expect(mocked.updateMirrorRequest).toHaveBeenCalledWith('p1', {
        enabled: true,
        sourcePath: '/src',
        targetPath: '/dst',
      }),
    );
    expect(await screen.findByText(/mirror saved/i)).toBeInTheDocument();
  });

  it('renders the entitlement error when the save is rejected', async () => {
    mocked.updateMirrorRequest.mockRejectedValue(new Error('Mirroring requires Business.'));
    renderDetail({ projects: { items: [baseProject()] }, entry: '/projects/p1?tab=mirror' });
    await waitFor(() => expect(mocked.listSchedulesRequest).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /save mirror/i }));
    expect(await screen.findByText('Mirroring requires Business.')).toBeInTheDocument();
  });

  it('reflects the saving state', () => {
    renderDetail({
      projects: { items: [baseProject()], mirrorSaveStatus: 'loading' },
      entry: '/projects/p1?tab=mirror',
    });
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
  });
});

describe('AlertsEditor', () => {
  it('saves the webhook url and clears it back to empty', async () => {
    mocked.updateAlertsRequest
      .mockResolvedValueOnce(baseProject({ alertWebhookUrl: 'https://hooks.example/x' }))
      .mockResolvedValueOnce(baseProject({ alertWebhookUrl: '' }));
    renderDetail({ projects: { items: [baseProject()] }, entry: '/projects/p1?tab=alerts' });
    await waitFor(() => expect(mocked.listSchedulesRequest).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/webhook url/i), {
      target: { value: 'https://hooks.example/x' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save alerts/i }));
    await waitFor(() =>
      expect(mocked.updateAlertsRequest).toHaveBeenCalledWith('p1', 'https://hooks.example/x'),
    );
    expect(await screen.findByText(/alerts saved/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    await waitFor(() => expect(mocked.updateAlertsRequest).toHaveBeenCalledWith('p1', ''));
    await waitFor(() =>
      expect((screen.getByLabelText(/webhook url/i) as HTMLInputElement).value).toBe(''),
    );
  });

  it('renders the entitlement error when the save is rejected', async () => {
    mocked.updateAlertsRequest.mockRejectedValue(new Error('Alerts require Pro.'));
    renderDetail({ projects: { items: [baseProject()] }, entry: '/projects/p1?tab=alerts' });
    await waitFor(() => expect(mocked.listSchedulesRequest).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /save alerts/i }));
    expect(await screen.findByText('Alerts require Pro.')).toBeInTheDocument();
  });

  it('reflects the saving state on both buttons', () => {
    renderDetail({
      projects: { items: [baseProject()], alertsSaveStatus: 'loading' },
      entry: '/projects/p1?tab=alerts',
    });
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /clear/i })).toBeDisabled();
  });
});
