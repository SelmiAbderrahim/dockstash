import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { i18n, initI18n } from '@shared/i18n';

const clearCookies = () => {
  document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'uid=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
};

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  clearCookies();
});

const renderComp = (ui: React.ReactNode) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nextProvider>,
  );

describe('Dashboard', () => {
  it('renders the core product navigation links', () => {
    renderComp(<Dashboard />);
    expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Snapshots' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Billing' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument();
  });

  it('shows the admin link only for admins', () => {
    document.cookie = `user=${encodeURIComponent(JSON.stringify({ role: 'Admin' }))}; path=/`;
    renderComp(<Dashboard />);
    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument();
  });

  it('hides the admin link for non-admins (no user cookie)', () => {
    renderComp(<Dashboard />);
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });
});
