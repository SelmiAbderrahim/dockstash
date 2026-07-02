import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { i18n, initI18n } from '@shared/i18n';
import { MarketingLocaleSwitcher } from './MarketingLocaleSwitcher';

const LocationProbe = () => {
  const { pathname } = useLocation();
  return <output data-testid="pathname">{pathname}</output>;
};

const renderSwitcher = (initialPath = '/pricing') =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[initialPath]}>
        <MarketingLocaleSwitcher />
        <LocationProbe />
      </MemoryRouter>
    </I18nextProvider>,
  );

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
});

afterEach(() => {
  cleanup();
});

describe('MarketingLocaleSwitcher', () => {
  it('navigates to the locale-prefixed base path and switches the language', async () => {
    renderSwitcher('/pricing');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ar' } });
    expect(screen.getByTestId('pathname')).toHaveTextContent('/ar/pricing');
    await waitFor(() => expect(i18n.language).toBe('ar'));
  });

  it('ignores a value that is not a supported locale', () => {
    renderSwitcher('/pricing');
    const select = screen.getByRole('combobox');
    const languageBefore = i18n.language;
    // A <select> coerces an unknown value to '' — not a supported locale.
    fireEvent.change(select, { target: { value: 'xx' } });
    expect(screen.getByTestId('pathname')).toHaveTextContent('/pricing');
    expect(i18n.language).toBe(languageBefore);
  });
});
