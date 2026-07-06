import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { configureStore } from '@reduxjs/toolkit';
import { HistoryPanel } from './HistoryPanel';
import { projectsReducer } from '../store/slice';
import type { Project, ProjectJob } from '../types';
import { i18n, initI18n } from '@shared/i18n';
import * as api from '../api';

vi.mock('../api', () => ({
  listProjectJobsRequest: vi.fn(async () => []),
}));

const mocked = vi.mocked(api);

const project = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  owner: 'u1',
  agentId: 'a1',
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
  lastRestoreAt: null,
  lastRestoreStatus: null,
  lastRestoreDetail: '',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...over,
});

const job = (over: Partial<ProjectJob> = {}): ProjectJob => ({
  id: 'j1',
  kind: 'restore',
  status: 'succeeded',
  createdAt: '2026-07-06T07:11:53Z',
  startedAt: '2026-07-06T07:11:54Z',
  finishedAt: '2026-07-06T07:11:59Z',
  error: '',
  restore: { snapshotId: '5ad025be', overwrite: true, targetPath: null },
  logTail: ['restore redis: done'],
  ...over,
});

const renderPanel = (p: Project = project()) => {
  const store = configureStore({ reducer: { projects: projectsReducer } });
  const utils = render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <HistoryPanel project={p} />
      </I18nextProvider>
    </Provider>,
  );
  return { store, ...utils };
};

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
  mocked.listProjectJobsRequest.mockResolvedValue([]);
});

describe('HistoryPanel', () => {
  it('fetches jobs for the project and shows the empty state', async () => {
    renderPanel();
    await waitFor(() => expect(mocked.listProjectJobsRequest).toHaveBeenCalledWith('p1'));
    expect(await screen.findByTestId('history-empty')).toBeInTheDocument();
  });

  it('renders the last-run stamp cards with never / pass / fail chips', async () => {
    renderPanel(
      project({
        lastStatus: 'failed',
        lastError: 'disk full',
        lastRunAt: '2026-07-01T00:00:00Z',
        lastRestoreAt: '2026-07-06T07:11:59Z',
        lastRestoreStatus: 'pass',
        lastDrillAt: null,
      }),
    );
    expect(screen.getByText('Last backup')).toBeInTheDocument();
    expect(screen.getByText('disk full')).toBeInTheDocument();
    expect(screen.getByText('Last restore')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
    // Drill never ran.
    expect(screen.getByText('Never')).toBeInTheDocument();
    await waitFor(() => expect(mocked.listProjectJobsRequest).toHaveBeenCalled());
  });

  it('marks a successful last backup with the success chip', async () => {
    renderPanel(project({ lastStatus: 'success', lastRunAt: '2026-07-01T00:00:00Z' }));
    expect(screen.getByText('Success')).toBeInTheDocument();
    await waitFor(() => expect(mocked.listProjectJobsRequest).toHaveBeenCalled());
  });

  it('shows an error alert when the history fetch fails', async () => {
    mocked.listProjectJobsRequest.mockRejectedValue(new Error('boom'));
    renderPanel();
    expect(await screen.findByText('boom')).toBeInTheDocument();
  });

  it('lists jobs and toggles the persisted log tail open and closed', async () => {
    const user = userEvent.setup();
    mocked.listProjectJobsRequest.mockResolvedValue([
      job(),
      job({
        id: 'j2',
        kind: 'backup',
        status: 'failed',
        error: 'restic exit 1',
        restore: null,
        startedAt: null,
        finishedAt: null,
        logTail: [],
      }),
      job({ id: 'j3', kind: 'check', status: 'pending', restore: null, error: '', logTail: [] }),
      job({ id: 'j4', kind: 'prune', status: 'leased', restore: null, error: '', logTail: [] }),
    ]);
    renderPanel();

    expect(await screen.findByText('5ad025be')).toBeInTheDocument();
    expect(screen.getByText('Succeeded')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Queued')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();

    // j1 has logs, j2 has an error → both expandable; j3/j4 have neither.
    const toggles = screen.getAllByRole('button', { name: 'Logs' });
    expect(toggles).toHaveLength(2);

    await user.click(toggles[0]!);
    expect(screen.getByTestId('history-logs-j1')).toHaveTextContent('restore redis: done');
    // Opening the second closes the first (single-open accordion behaviour).
    await user.click(screen.getByRole('button', { name: 'Logs' }));
    expect(screen.getByTestId('history-logs-j2')).toHaveTextContent('restic exit 1');
    expect(screen.queryByTestId('history-logs-j1')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByTestId('history-logs-j2')).not.toBeInTheDocument();
  });
});
