import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { i18n, initI18n } from '@shared/i18n';
import { useIsMobile } from '@shared/hooks/use-mobile';
import { markCompleted, saveResume } from '../lib/progressStorage';
import { guideReducer } from '../store/slice';
import * as thunks from '../store/thunks';
import type { GuideState, TourDefinition } from '../types';
import { GuidePanel } from './GuidePanel';

vi.mock('@shared/hooks/use-mobile', () => ({ useIsMobile: vi.fn(() => false) }));

vi.mock('../store/thunks', async () => {
  const actual = await vi.importActual<typeof import('../store/thunks')>('../store/thunks');
  return {
    setGuideMe: Object.assign(
      vi.fn(() => () => Promise.resolve()),
      actual.setGuideMe,
    ),
  };
});

vi.mock('../tours', () => {
  const TOURS: TourDefinition[] = [
    {
      id: 'alpha',
      titleKey: 'alpha.title',
      descriptionKey: 'alpha.desc',
      routePrefix: '/alpha',
      steps: [
        { route: '/alpha', target: 'a1', titleKey: 'a1.t', bodyKey: 'a1.b', placement: 'bottom' },
      ],
    },
    {
      id: 'beta',
      titleKey: 'beta.title',
      descriptionKey: 'beta.desc',
      routePrefix: '/beta',
      steps: [
        { target: 'b1', titleKey: 'b1.t', bodyKey: 'b1.b', placement: 'top' },
        { target: 'b2', titleKey: 'b2.t', bodyKey: 'b2.b', placement: 'top' },
      ],
    },
  ];
  return {
    GUIDE_TOURS: TOURS,
    findTour: (id: string | null) => TOURS.find((tour) => tour.id === id) ?? null,
    sortToursForRoute: () => [...TOURS],
  };
});

const mockedThunks = vi.mocked(thunks);
const mockedIsMobile = vi.mocked(useIsMobile);

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="loc">{location.pathname + location.search}</div>;
};

const renderPanel = (over: Partial<GuideState> = {}, entry = '/alpha') => {
  const store = configureStore({
    reducer: { guide: guideReducer },
    preloadedState: {
      guide: {
        enabled: true,
        saving: false,
        error: null,
        panelOpen: true,
        activeTourId: null,
        stepIndex: 0,
        ...over,
      },
    },
  });
  render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="*" element={<LocationProbe />} />
          </Routes>
          <GuidePanel />
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
  return store;
};

const sheetContent = () =>
  document.querySelector('[data-slot="sheet-content"]') as HTMLElement | null;

beforeEach(() => {
  window.localStorage.clear();
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
  mockedIsMobile.mockReturnValue(false);
});

afterEach(() => {
  document.dir = '';
});

describe('GuidePanel', () => {
  it('lists tours with progress and marks the current page', () => {
    renderPanel();
    expect(screen.getByText('Guide me')).toBeInTheDocument();
    expect(screen.getByText('0 of 2 completed')).toBeInTheDocument();
    expect(screen.getByText('alpha.title')).toBeInTheDocument();
    expect(screen.getByText('beta.desc')).toBeInTheDocument();
    expect(screen.getAllByText("You're here")).toHaveLength(1);
  });

  it('starts a tour and navigates to its first step route', () => {
    const store = renderPanel({}, '/elsewhere');
    const buttons = screen.getAllByRole('button', { name: 'Start' });
    fireEvent.click(buttons[0] as HTMLElement);
    expect(store.getState().guide).toMatchObject({
      activeTourId: 'alpha',
      stepIndex: 0,
      panelOpen: false,
    });
    expect(screen.getByTestId('loc')).toHaveTextContent('/alpha');
  });

  it('starts a route-less tour without navigating', () => {
    const store = renderPanel({}, '/elsewhere');
    const buttons = screen.getAllByRole('button', { name: 'Start' });
    fireEvent.click(buttons[1] as HTMLElement);
    expect(store.getState().guide.activeTourId).toBe('beta');
    expect(screen.getByTestId('loc')).toHaveTextContent('/elsewhere');
  });

  it('shows completion state and a replay action', () => {
    markCompleted('alpha');
    renderPanel();
    expect(screen.getByText('1 of 2 completed')).toBeInTheDocument();
    expect(screen.getByLabelText('Completed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replay' })).toBeInTheDocument();
  });

  it('offers resume and clamps a stale step index', () => {
    saveResume({ tourId: 'beta', stepIndex: 99 });
    const store = renderPanel();
    const resumeButton = screen.getByRole('button', { name: 'Resume from step 100' });
    fireEvent.click(resumeButton);
    expect(store.getState().guide).toMatchObject({ activeTourId: 'beta', stepIndex: 1 });
  });

  it('toggles the preference off from the footer switch', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('switch'));
    expect(mockedThunks.setGuideMe).toHaveBeenCalledWith(false);
  });

  it('disables the switch while saving and shows errors', () => {
    renderPanel({ saving: true, error: 'boom' });
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
  });

  it('closes via Escape', () => {
    const store = renderPanel();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(store.getState().guide.panelOpen).toBe(false);
  });

  it('renders as a bottom sheet on mobile', () => {
    mockedIsMobile.mockReturnValue(true);
    renderPanel();
    expect(sheetContent()?.className).toContain('bottom-0');
  });

  it('slides from the logical end side per direction', () => {
    renderPanel();
    expect(sheetContent()?.className).toContain('right-0');
    cleanup();
    document.dir = 'rtl';
    renderPanel();
    expect(sheetContent()?.className).toContain('left-0');
  });
});
