import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { i18n, initI18n } from '@shared/i18n';
import { AppFrameFooter } from './AppFrameFooter';

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
});

describe('AppFrameFooter', () => {
  it('renders copyright + guides/security/privacy/terms links', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <AppFrameFooter />
        </MemoryRouter>
      </I18nextProvider>,
    );
    expect(screen.getByText(/All Rights Reserved/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Guides' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Security' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Terms' })).toBeInTheDocument();
  });
});
