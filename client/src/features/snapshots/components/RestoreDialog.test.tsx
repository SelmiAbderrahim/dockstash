import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  return render(
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

  it('overwrite mode defaults OFF, is an explicit opt-in', () => {
    renderDialog();
    const radios = screen.getAllByRole('radio');
    const [newLoc, overwrite] = radios as [HTMLInputElement, HTMLInputElement];
    expect(newLoc.checked).toBe(true);
    expect(overwrite.checked).toBe(false);
    fireEvent.click(overwrite);
    expect(overwrite.checked).toBe(true);
  });
});
