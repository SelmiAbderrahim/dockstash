import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { configureStore } from '@reduxjs/toolkit';
import { i18n, initI18n } from '@shared/i18n';
import { guideReducer } from '../store/slice';
import { GuideLauncher } from './GuideLauncher';

const pointer = (type: 'pointerdown' | 'pointermove' | 'pointerup', x: number, y: number) =>
  new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });

const renderLauncher = () => {
  const store = configureStore({ reducer: { guide: guideReducer } });
  render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <GuideLauncher />
      </I18nextProvider>
    </Provider>,
  );
  return store;
};

const launcher = () => screen.getByRole('button', { name: 'Open the guide' });

beforeEach(() => {
  window.localStorage.clear();
  initI18n({ initialLocale: 'en' });
});

describe('GuideLauncher', () => {
  it('opens the panel on click and dismisses the first-run nudge', () => {
    const store = renderLauncher();
    expect(screen.getByText('New here? I can walk you through setup.')).toBeInTheDocument();

    fireEvent(launcher(), pointer('pointerdown', 500, 300));
    fireEvent(launcher(), pointer('pointerup', 500, 300));

    expect(store.getState().guide.panelOpen).toBe(true);
    expect(screen.queryByText('New here? I can walk you through setup.')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('guide:nudge-seen')).toBe('1');

    // A second activation with the nudge already gone just opens the panel.
    fireEvent(launcher(), pointer('pointerdown', 500, 300));
    fireEvent(launcher(), pointer('pointerup', 500, 300));
    expect(store.getState().guide.panelOpen).toBe(true);
  });

  it('does not show the nudge again once seen', () => {
    window.localStorage.setItem('guide:nudge-seen', '1');
    renderLauncher();
    expect(screen.queryByText('New here? I can walk you through setup.')).not.toBeInTheDocument();
  });

  it('nudge CTA opens the panel; the X only dismisses', () => {
    let store = renderLauncher();
    fireEvent.click(screen.getByRole('button', { name: 'Show me' }));
    expect(store.getState().guide.panelOpen).toBe(true);

    window.localStorage.clear();
    cleanup();
    store = renderLauncher();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(store.getState().guide.panelOpen).toBe(false);
    expect(screen.queryByText('New here? I can walk you through setup.')).not.toBeInTheDocument();
  });

  it('opens the panel with Shift+? except while typing', () => {
    const store = renderLauncher();
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    document.body.append(input, textarea);

    fireEvent.keyDown(input, { key: '?', shiftKey: true });
    fireEvent.keyDown(textarea, { key: '?', shiftKey: true });
    fireEvent.keyDown(document.body, { key: '?', shiftKey: false });
    fireEvent.keyDown(document.body, { key: 'a', shiftKey: true });
    expect(store.getState().guide.panelOpen).toBe(false);

    // Non-element targets (the document itself) are not typing surfaces.
    fireEvent.keyDown(document, { key: '?', shiftKey: true });
    expect(store.getState().guide.panelOpen).toBe(true);
    input.remove();
    textarea.remove();
  });

  it('drags without opening the panel and shows the grabbing cursor', () => {
    const store = renderLauncher();
    fireEvent(launcher(), pointer('pointerdown', 1000, 300));
    fireEvent(launcher(), pointer('pointermove', 1000, 400));
    expect(launcher().className).toContain('cursor-grabbing');
    fireEvent(launcher(), pointer('pointerup', 100, 400));
    expect(store.getState().guide.panelOpen).toBe(false);
    expect(launcher().style.insetInlineStart).toBe('0.75rem');
    // The nudge survives a drag and follows the launcher to the start side.
    expect(screen.getByRole('status').style.insetInlineStart).toBe('4.25rem');
  });
});
