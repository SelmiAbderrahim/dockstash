import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { SnapshotsScreen } from './SnapshotsScreen';
import { snapshotsReducer } from '../store/slice';
import { projectsReducer } from '@features/projects';
import { i18n, initI18n } from '@shared/i18n';
import type { Project } from '@features/projects/types';
import type { Snapshot } from '../types';

// Inert snapshots thunks: keep the real static matchers so the slice builds,
// but make dispatch a no-op so the mount-time fetch never overrides the state
// that each test drives via preloadedState.
vi.mock('../store/thunks', async () => {
  const actual = await vi.importActual<typeof import('../store/thunks')>('../store/thunks');
  const make = (orig: unknown) =>
    Object.assign(
      vi.fn(() => () => Promise.resolve()),
      orig as object,
    );
  return { fetchSnapshots: make(actual.fetchSnapshots), restore: make(actual.restore) };
});

// Stub the low-level client so the mount-time projects fetch never hits the
// network. The real projects thunks/reducer stay intact.
vi.mock('@shared/api/client', async () => {
  const actual = await vi.importActual<typeof import('@shared/api/client')>('@shared/api/client');
  return { ...actual, apiClient: vi.fn(async () => ({ projects: [] })) };
});

vi.mock('@shared/components/ResticLogPanel', () => ({
  ResticLogPanel: ({ onDone, title }: { onDone: () => void; title: string }) => (
    <div data-testid="log-panel">
      <span>{title}</span>
      <button type="button" onClick={onDone}>
        done
      </button>
    </div>
  ),
}));

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
});

const makeProject = (over: Partial<Project> = {}): Project =>
  ({
    id: 'p1',
    owner: 'o',
    name: 'my-project',
    path: '/srv',
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
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Project;

interface Options {
  projects?: Project[];
  byProject?: Record<string, Snapshot[]>;
  status?: 'idle' | 'loading' | 'succeeded' | 'failed';
  error?: string | null;
  activeRestoreJobId?: string | null;
  entry?: string;
}

const renderScreen = (opts: Options = {}) => {
  const store = configureStore({
    reducer: { snapshots: snapshotsReducer, projects: projectsReducer },
    preloadedState: {
      snapshots: {
        byProject: opts.byProject ?? {},
        status: opts.status ?? 'idle',
        error: opts.error ?? null,
        activeRestoreJobId: opts.activeRestoreJobId ?? null,
      },
      projects: {
        items: opts.projects ?? [],
        status: 'succeeded' as const,
        error: null,
        activeJobByProject: {},
        schedules: [],
        schedulesStatus: 'idle' as const,
        scheduleSaveStatus: 'idle' as const,
        planSaveStatus: 'idle' as const,
      },
    },
  });
  const utils = render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[opts.entry ?? '/snapshots']}>
          <SnapshotsScreen />
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
  return { ...utils, store };
};

describe('SnapshotsScreen', () => {
  it('with no projects: renders heading and no project select (mount fetch runs)', () => {
    renderScreen({ projects: [] });
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('shows a loading indicator', () => {
    renderScreen({ projects: [makeProject()], status: 'loading' });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows an error alert with the error text', () => {
    renderScreen({ projects: [makeProject()], status: 'failed', error: 'kaboom' });
    expect(screen.getByRole('alert')).toHaveTextContent('kaboom');
  });

  it('falls back to a default alert message when failed with no error', () => {
    renderScreen({ projects: [makeProject()], status: 'failed', error: null });
    expect(screen.getByRole('alert')).toHaveTextContent(/could not load/i);
  });

  it('shows the empty state when succeeded with no snapshots', () => {
    renderScreen({ projects: [makeProject()], status: 'succeeded', byProject: { p1: [] } });
    expect(document.querySelector('.ds-empty')).toBeTruthy();
  });

  it('renders a table of snapshots and formats byte sizes', () => {
    renderScreen({
      projects: [makeProject()],
      status: 'succeeded',
      byProject: {
        p1: [
          { id: 's1', projectId: 'p1', time: '2024-01-01T00:00:00Z', sizeBytes: 0 },
          { id: 's2', projectId: 'p1', time: '2024-01-02T00:00:00Z', sizeBytes: 1500000 },
        ],
      },
    });
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('0 B')).toBeInTheDocument();
    expect(screen.getByText('1.4 MB')).toBeInTheDocument();
  });

  it('opens the restore dialog when Restore is clicked', () => {
    renderScreen({
      projects: [makeProject()],
      status: 'succeeded',
      byProject: { p1: [{ id: 's1', projectId: 'p1', time: '', sizeBytes: 10 }] },
    });
    fireEvent.click(screen.getByRole('button', { name: /restore/i }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    // Closing the dialog runs the onClose callback (setTarget(null)).
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('switching the project selector updates the URL param', () => {
    renderScreen({
      projects: [makeProject(), makeProject({ id: 'p2', name: 'second' })],
      status: 'succeeded',
      byProject: { p1: [], p2: [] },
    });
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'p2' } });
    expect(select.value).toBe('p2');
  });

  it('renders the log panel when a restore job is active and clears it on done', () => {
    const { store } = renderScreen({
      projects: [makeProject()],
      status: 'succeeded',
      activeRestoreJobId: 'job-42',
    });
    expect(screen.getByTestId('log-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'done' }));
    expect(store.getState().snapshots.activeRestoreJobId).toBeNull();
  });

  it('disables Restore (and never opens the dialog) when the project is unknown', () => {
    renderScreen({
      projects: [makeProject()],
      status: 'succeeded',
      byProject: { ghost: [{ id: 's1', projectId: 'ghost', time: '', sizeBytes: 10 }] },
      entry: '/snapshots?projectId=ghost',
    });
    const restoreBtn = screen.getByRole('button', { name: /restore/i }) as HTMLButtonElement;
    expect(restoreBtn.disabled).toBe(true);
    fireEvent.click(restoreBtn);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
