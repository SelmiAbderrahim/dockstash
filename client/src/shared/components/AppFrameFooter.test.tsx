import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { i18n, initI18n } from '@shared/i18n';
import { SOURCE_URL } from '@shared/sourceUrl';
import { AppFrameFooter } from './AppFrameFooter';

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
});

describe('AppFrameFooter', () => {
  it('renders the copyright line', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <AppFrameFooter />
        </MemoryRouter>
      </I18nextProvider>,
    );
    expect(screen.getByText(/All Rights Reserved/i)).toBeInTheDocument();
  });

  // AGPL-3.0 §13: a network-facing instance must offer its source to users.
  // The link has to stay reachable from the running app, so it is asserted
  // rather than left to review.
  it('offers the source code as an external link (AGPL §13)', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <AppFrameFooter />
        </MemoryRouter>
      </I18nextProvider>,
    );
    const link = screen.getByRole('link', { name: /source code/i });
    expect(link).toHaveAttribute('href', SOURCE_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });
});
