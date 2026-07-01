import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { configureStore } from '@reduxjs/toolkit';
import { RestoreDialog } from './RestoreDialog';
import { snapshotsReducer } from '../store/slice';
import { i18n, initI18n } from '@shared/i18n';

vi.mock('../api', () => ({
  listSnapshotsRequest: vi.fn(),
  restoreRequest: vi.fn(async () => 'job-1'),
}));

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
});

const renderDialog = (props: Partial<React.ComponentProps<typeof RestoreDialog>> = {}) => {
  const store = configureStore({ reducer: { snapshots: snapshotsReducer } });
  const utils = render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <RestoreDialog
          snapshot={{ id: 's1', projectId: 'p1', time: '', sizeBytes: 0 }}
          projectId="p1"
          projectName="my-project"
          open
          onClose={() => {}}
          {...props}
        />
      </I18nextProvider>
    </Provider>,
  );
  const rerender = (next: Partial<React.ComponentProps<typeof RestoreDialog>>) =>
    utils.rerender(
      <Provider store={store}>
        <I18nextProvider i18n={i18n}>
          <RestoreDialog
            snapshot={{ id: 's1', projectId: 'p1', time: '', sizeBytes: 0 }}
            projectId="p1"
            projectName="my-project"
            open
            onClose={() => {}}
            {...props}
            {...next}
          />
        </I18nextProvider>
      </Provider>,
    );
  return { ...utils, store, rerender };
};

describe('RestoreDialog typed-confirm', () => {
  it('confirm button is disabled until project name matches exactly', () => {
    renderDialog();
    const confirm = screen.getByTestId('restore-confirm') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    const typeInput = screen.getByRole('textbox', {
      name: /Type "my-project" to confirm/i,
    });
    // Wrong case: still disabled
    fireEvent.change(typeInput, { target: { value: 'My-Project' } });
    expect(confirm.disabled).toBe(true);

    // Target path required for "new location" mode
    const targetInput = screen.getByRole('textbox', { name: /Target path/i });
    fireEvent.change(targetInput, { target: { value: '/var/restores/x' } });
    // Still disabled - typed value still wrong
    expect(confirm.disabled).toBe(true);

    // Correct match enables it
    fireEvent.change(typeInput, { target: { value: 'my-project' } });
    expect(confirm.disabled).toBe(false);
  });

  it('overwrite mode defaults OFF, is an explicit opt-in', async () => {
    // Radix RadioGroupItem renders a <button role="radio"> whose state lives in
    // aria-checked (not a native `.checked`) and toggles on a real click, so we
    // drive it with user-event and assert on aria-checked.
    const user = userEvent.setup();
    renderDialog();
    const radios = screen.getAllByRole('radio');
    const [newLoc, overwrite] = radios as [HTMLElement, HTMLElement];
    expect(newLoc).toHaveAttribute('aria-checked', 'true');
    expect(overwrite).toHaveAttribute('aria-checked', 'false');
    await user.click(overwrite);
    expect(overwrite).toHaveAttribute('aria-checked', 'true');
    // Toggling back to "new location" runs its onChange (setOverwrite(false)).
    await user.click(newLoc);
    expect(newLoc).toHaveAttribute('aria-checked', 'true');
    await user.click(overwrite);
    // Overwrite mode hides the target-path field and enables via typed match only.
    const confirm = screen.getByTestId('restore-confirm') as HTMLButtonElement;
    const typeInput = screen.getByRole('textbox', { name: /Type "my-project" to confirm/i });
    fireEvent.change(typeInput, { target: { value: 'my-project' } });
    expect(confirm.disabled).toBe(false);
  });

  it('renders nothing when closed', () => {
    const { container } = renderDialog({ open: false });
    expect(container.firstChild).toBeNull();
  });

  it('confirming dispatches restore, calls onConfirmed and onClose (overwrite)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirmed = vi.fn();
    const { store } = renderDialog({ onClose, onConfirmed });
    await user.click(screen.getAllByRole('radio')[1]!);
    fireEvent.change(
      screen.getByRole('textbox', { name: /Type "my-project" to confirm/i }),
      { target: { value: 'my-project' } },
    );
    fireEvent.click(screen.getByTestId('restore-confirm'));
    expect(onConfirmed).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(store.getState().snapshots).toBeTruthy();
  });

  it('confirming works without an onConfirmed callback (new location)', () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    fireEvent.change(
      screen.getByRole('textbox', { name: /Type "my-project" to confirm/i }),
      { target: { value: 'my-project' } },
    );
    fireEvent.change(screen.getByRole('textbox', { name: /Target path/i }), {
      target: { value: '/var/restores/x' },
    });
    fireEvent.click(screen.getByTestId('restore-confirm'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape key triggers onClose', () => {
    // Radix's DismissableLayer listens for Escape on the document, so dispatch
    // the keydown there (a window-target keydown never reaches that listener).
    const onClose = vi.fn();
    renderDialog({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('ignores non-Escape keys', () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Cancel button closes the dialog', () => {
    // AlertDialog does not close on overlay/backdrop click by design; the
    // explicit Cancel action is the dismissal path.
    const onClose = vi.fn();
    renderDialog({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the previously focused element when it closes', async () => {
    // Radix FocusScope restores focus asynchronously (setTimeout) on unmount.
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const { rerender } = renderDialog();
    rerender({ open: false });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    trigger.remove();
  });
});
