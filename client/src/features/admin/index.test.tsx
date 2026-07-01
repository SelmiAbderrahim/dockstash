import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as admin from './index';
import { AdminDashboard } from './components/AdminDashboard';
import { adminRoutes } from './routes';

describe('admin public API barrel', () => {
  it('re-exports adminRoutes and AdminDashboard', () => {
    expect(admin.adminRoutes).toBe(adminRoutes);
    expect(admin.AdminDashboard).toBe(AdminDashboard);
    expect(admin.adminRoutes[0]?.path).toBe('admin');
  });

  it('renders the admin dashboard placeholder', () => {
    render(<AdminDashboard />);
    expect(screen.getByText(/admin navigation/i)).toBeInTheDocument();
  });
});
