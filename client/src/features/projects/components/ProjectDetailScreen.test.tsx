import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
}));

const mocked = vi.mocked(api);

const baseProject = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  owner: 'u1',
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

const schedule = (over: Partial<Schedule> = {}): Schedule => ({
  id: 's1',
  projectId: 'p1',
  kind: 'backup',
  cron: '0 5 * * *',
  enabled: true,
  retention: { keepDaily: 7, keepWeekly: 4, keepMonthly: 6 },
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
};

const makeStore = (projects: Partial<ProjectsState> = {}) =>
  configureStore({
    reducer: { projects: projectsReducer },
    preloadedState: { projects: { ...baseState, ...projects } },
  });

const renderDetail = (
  { projects = {}, entry = '/projects/p1' }: { projects?: Partial<ProjectsState>; entry?: string } = {},
) => {
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
    // fetchProjects should NOT run because the project is already present.
    await waitFor(() => expect(mocked.listSchedulesRequest).toHaveBeenCalled());
    expect(mocked.listProjectsRequest).not.toHaveBeenCalled();

    expect(screen.getByRole('heading', { name: 'app' })).toBeInTheDocument();
    // Default tab is plan.
    expect(screen.getByRole('button', { name: /save plan/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /schedule/i }));
    expect(await screen.findByRole('button', { name: /save schedule/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /restore drill/i }));
    expect(await screen.findByRole('heading', { name: /restore drill/i })).toBeInTheDocument();
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
