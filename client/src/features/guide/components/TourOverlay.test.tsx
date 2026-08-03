import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { i18n, initI18n } from '@shared/i18n';
import { loadProgress, saveResume } from '../lib/progressStorage';
import { guideReducer, startTour } from '../store/slice';
import type { TourDefinition } from '../types';
import { TourOverlay } from './TourOverlay';

vi.mock('../tours', () => {
  const TOURS: TourDefinition[] = [
    {
      id: 'multi',
      titleKey: 'multi.title',
      descriptionKey: 'multi.desc',
      routePrefix: '/a',
      steps: [
        {
          route: '/a',
          target: 't1',
          titleKey: 't1.t',
          bodyKey: 't1.b',
          placement: 'bottom',
          advanceOn: 'input',
        },
        { route: '/b', target: 't2', titleKey: 't2.t', bodyKey: 't2.b', placement: 'top' },
        {
          target: 't3',
          titleKey: 't3.t',
          bodyKey: 't3.b',
          placement: 'auto',
          advanceOn: 'click',
        },
      ],
    },
    {
      id: 'flick',
      titleKey: 'flick.title',
      descriptionKey: 'flick.desc',
      routePrefix: '/a',
      steps: [
        {
          route: '/a',
          target: 'f1',
          titleKey: 'f1.t',
          bodyKey: 'f1.b',
          placement: 'start',
          advanceOn: 'click',
        },
        {
          route: '/a',
          target: 'f2-missing',
          titleKey: 'f2.t',
          bodyKey: 'f2.b',
          placement: 'end',
          advanceOn: 'input',
        },
      ],
    },
    {
      id: 'ghost',
      titleKey: 'ghost.title',
      descriptionKey: 'ghost.desc',
      routePrefix: '/ghost',
      steps: [
        { route: '/ghost', target: 'g1', titleKey: 'g1.t', bodyKey: 'g1.b', placement: 'bottom' },
        { route: '/ghost', target: 'g2', titleKey: 'g2.t', bodyKey: 'g2.b', placement: 'bottom' },
      ],
    },
    {
      id: 'solo',
      titleKey: 'solo.title',
      descriptionKey: 'solo.desc',
      routePrefix: '/x',
      steps: [{ target: 'solo-t', titleKey: 's.t', bodyKey: 's.b', placement: 'end' }],
    },
    {
      id: 'dup',
      titleKey: 'dup.title',
      descriptionKey: 'dup.desc',
      routePrefix: '/a',
      steps: [
        { target: 'dup-t', titleKey: 'd1.t', bodyKey: 'd1.b', placement: 'bottom' },
        { target: 'dup-t', titleKey: 'd2.t', bodyKey: 'd2.b', placement: 'top' },
      ],
    },
  ];
  return {
    GUIDE_TOURS: TOURS,
    findTour: (id: string | null) => TOURS.find((tour) => tour.id === id) ?? null,
    sortToursForRoute: () => [...TOURS],
  };
});

const PageA = () => (
  <div>
    <input data-tour="t1" aria-label="input one" />
    <button type="button" data-tour="f1">
      eff one
    </button>
    <input data-tour="dup-t" aria-label="dup input" />
  </div>
);

const PageB = () => (
  <div>
    <div data-tour="t2">two</div>
    <button type="button" data-tour="t3">
      three
    </button>
  </div>
);

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="loc">{location.pathname + location.search}</div>;
};

const renderOverlay = (tourId: string, stepIndex = 0, entry = '/a') => {
  const store = configureStore({ reducer: { guide: guideReducer } });
  store.dispatch(startTour({ tourId, stepIndex }));
  render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[entry]}>
          <button type="button" data-guide-launcher>
            L
          </button>
          <Routes>
            <Route path="/a" element={<PageA />} />
            <Route path="/b" element={<PageB />} />
            <Route path="*" element={<div>elsewhere</div>} />
          </Routes>
          <LocationProbe />
          <TourOverlay />
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
  return store;
};

beforeEach(() => {
  window.localStorage.clear();
  initI18n({ initialLocale: 'en' });
});

afterEach(() => {
  document.dir = '';
  vi.useRealTimers();
});

describe('TourOverlay', () => {
  it('renders nothing without an active tour', () => {
    const store = configureStore({ reducer: { guide: guideReducer } });
    render(
      <Provider store={store}>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <TourOverlay />
          </MemoryRouter>
        </I18nextProvider>
      </Provider>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('spotlights the found target with title, body, and a counter', () => {
    renderOverlay('multi');
    expect(screen.getByRole('dialog', { name: 't1.t' })).toBeInTheDocument();
    expect(screen.getByText('t1.b')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByTestId('guide-spotlight')).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
  });

  it('navigates to the step route when elsewhere', async () => {
    renderOverlay('multi', 0, '/nowhere');
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/a'));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 't1.t' })).toBeInTheDocument());
  });

  it('labels Next as "Take me there" for a cross-route step and follows it', async () => {
    renderOverlay('multi');
    const nextButton = screen.getByRole('button', { name: 'Take me there' });
    fireEvent.click(nextButton);
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/b'));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 't2.t' })).toBeInTheDocument());
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    // Back is enabled past the first step; t2→t3 shows a plain Next (no route on t3).
    expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('disables Back on the first step and steps back from the second', async () => {
    renderOverlay('multi');
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Take me there' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 't2.t' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 't1.t' })).toBeInTheDocument());
  });

  it('finishes on Done, records completion, and returns focus to the launcher', async () => {
    const store = renderOverlay('multi', 2, '/b');
    await waitFor(() => expect(screen.getByRole('dialog', { name: 't3.t' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(store.getState().guide.activeTourId).toBeNull();
    expect(loadProgress().completed).toContain('multi');
    expect(document.activeElement).toBe(document.querySelector('[data-guide-launcher]'));
  });

  it('clamps an out-of-range step index to the last step', async () => {
    renderOverlay('multi', 99, '/b');
    await waitFor(() => expect(screen.getByRole('dialog', { name: 't3.t' })).toBeInTheDocument());
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
  });

  it('pauses with a resume bookmark on Escape', () => {
    const store = renderOverlay('multi');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(store.getState().guide.activeTourId).toBeNull();
    expect(loadProgress().resume).toEqual({ tourId: 'multi', stepIndex: 0 });
  });

  it('pauses via the close button too', () => {
    const store = renderOverlay('multi');
    fireEvent.click(screen.getByRole('button', { name: 'Close the tour' }));
    expect(store.getState().guide.activeTourId).toBeNull();
    expect(loadProgress().resume).toEqual({ tourId: 'multi', stepIndex: 0 });
  });

  it('abandons without a bookmark on Skip tour', () => {
    saveResume({ tourId: 'multi', stepIndex: 0 });
    const store = renderOverlay('multi');
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(store.getState().guide.activeTourId).toBeNull();
    expect(loadProgress().resume).toBeNull();
    expect(loadProgress().completed).not.toContain('multi');
  });

  it('steps with arrow keys, flipped in RTL', async () => {
    const store = renderOverlay('multi');
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(store.getState().guide.stepIndex).toBe(1);
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(store.getState().guide.stepIndex).toBe(0);
    // ArrowLeft on the first step is a no-op.
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(store.getState().guide.stepIndex).toBe(0);

    cleanup();
    document.dir = 'rtl';
    const rtlStore = renderOverlay('multi');
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(rtlStore.getState().guide.stepIndex).toBe(1);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(rtlStore.getState().guide.stepIndex).toBe(0);
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 't1.t' })).toBeInTheDocument(),
    );
  });

  it('auto-advances when the user performs the step action', async () => {
    const store = renderOverlay('multi');
    fireEvent.change(screen.getByLabelText('input one'), { target: { value: 'secret' } });
    expect(store.getState().guide.stepIndex).toBe(1);
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/b'));
  });

  it('auto-advancing a click step on the last step completes the tour', async () => {
    const store = renderOverlay('multi', 2, '/b');
    await waitFor(() => expect(screen.getByRole('dialog', { name: 't3.t' })).toBeInTheDocument());
    fireEvent.click(screen.getByText('three'));
    expect(store.getState().guide.activeTourId).toBeNull();
    expect(loadProgress().completed).toContain('multi');
  });

  it('handles a next step whose target is not yet on the page', async () => {
    const store = renderOverlay('flick');
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'f1.t' })).toBeInTheDocument());
    // Same-route next step keeps the plain Next label.
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(store.getState().guide.stepIndex).toBe(1);
    expect(screen.getByText('Finding the right spot…')).toBeInTheDocument();
  });

  it('shows the missing card with retry, skip, and end actions', async () => {
    vi.useFakeTimers();
    const store = renderOverlay('ghost', 0, '/ghost');
    expect(screen.getByText('Finding the right spot…')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText("This element isn't visible right now.")).toBeInTheDocument();

    // Retry re-navigates to the step route.
    fireEvent.click(screen.getByRole('button', { name: 'Take me there' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/ghost');

    // Skip step moves on (not the last step → "Skip step").
    fireEvent.click(screen.getByRole('button', { name: 'Skip step' }));
    expect(store.getState().guide.stepIndex).toBe(1);
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // End tour abandons entirely.
    fireEvent.click(screen.getByRole('button', { name: 'End tour' }));
    expect(store.getState().guide.activeTourId).toBeNull();
  });

  it('offers Done instead of Skip step for a missing last step without a route', () => {
    vi.useFakeTimers();
    const store = renderOverlay('solo', 0, '/x');
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByRole('button', { name: 'Take me there' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(store.getState().guide.activeTourId).toBeNull();
    expect(loadProgress().completed).toContain('solo');
  });

  it('keeps focus inside the card unless the user is in the target', () => {
    renderOverlay('multi');
    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(dialog);

    // Focusing the highlighted element is allowed.
    const input = screen.getByLabelText('input one');
    input.focus();
    expect(document.activeElement).toBe(input);

    // Focusing anything else snaps back to the card.
    (document.querySelector('[data-guide-launcher]') as HTMLElement).focus();
    expect(document.activeElement).toBe(dialog);
  });

  it('keeps focus in the target across steps that share the same element', () => {
    const store = renderOverlay('dup');
    const input = screen.getByLabelText('dup input');
    input.focus();
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(store.getState().guide.stepIndex).toBe(1);
    // The new step targets the same element, so focus is not stolen.
    expect(document.activeElement).toBe(input);
  });

  it('measures the tooltip once real dimensions are available', () => {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      value: 300,
      configurable: true,
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      value: 150,
      configurable: true,
    });
    renderOverlay('multi');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // A rect refresh with identical dimensions bails out of the size update.
    fireEvent.scroll(window);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Reset the prototype overrides.
    delete (HTMLElement.prototype as { offsetWidth?: unknown }).offsetWidth;
    delete (HTMLElement.prototype as { offsetHeight?: unknown }).offsetHeight;
  });
});
