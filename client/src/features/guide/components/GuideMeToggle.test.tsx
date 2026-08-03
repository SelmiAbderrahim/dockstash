import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { configureStore } from '@reduxjs/toolkit';
import { i18n, initI18n } from '@shared/i18n';
import { guideReducer } from '../store/slice';
import type { GuideState } from '../types';
import * as thunks from '../store/thunks';
import { GuideMeToggle } from './GuideMeToggle';

vi.mock('../store/thunks', async () => {
  const actual = await vi.importActual<typeof import('../store/thunks')>('../store/thunks');
  return {
    setGuideMe: Object.assign(
      vi.fn(() => () => Promise.resolve()),
      actual.setGuideMe,
    ),
  };
});

const mocked = vi.mocked(thunks);

const renderToggle = (over: Partial<GuideState> = {}) => {
  const store = configureStore({
    reducer: { guide: guideReducer },
    preloadedState: {
      guide: {
        enabled: true,
        saving: false,
        error: null,
        panelOpen: false,
        activeTourId: null,
        stepIndex: 0,
        ...over,
      },
    },
  });
  render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <GuideMeToggle />
      </I18nextProvider>
    </Provider>,
  );
  return store;
};

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
});

describe('GuideMeToggle', () => {
  it('renders the labelled switch in the enabled state', () => {
    renderToggle();
    expect(screen.getByText('Show the guide assistant')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('dispatches the preference thunk on toggle', () => {
    renderToggle();
    fireEvent.click(screen.getByRole('switch'));
    expect(mocked.setGuideMe).toHaveBeenCalledWith(false);
  });

  it('dispatches enable when currently off', () => {
    renderToggle({ enabled: false });
    expect(screen.getByRole('switch')).not.toBeChecked();
    fireEvent.click(screen.getByRole('switch'));
    expect(mocked.setGuideMe).toHaveBeenCalledWith(true);
  });

  it('disables while saving and surfaces errors', () => {
    renderToggle({ saving: true, error: 'boom' });
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
  });
});
