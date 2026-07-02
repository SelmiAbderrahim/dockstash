import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminDashboard, adminRoutes } from './index';

describe('admin feature', () => {
  it('renders the admin dashboard placeholder', () => {
    render(<AdminDashboard />);
    expect(screen.getByText(/admin navigation/i)).toBeInTheDocument();
  });

  it('shows the coming-soon alert above the section table', () => {
    render(<AdminDashboard />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/admin console coming soon/i);
    expect(alert).toHaveTextContent(/under construction/i);
    // The existing navigation table stays in place below the alert.
    expect(screen.getByTestId('admin-section-overview')).toBeInTheDocument();
  });

  it('exposes an /admin route', () => {
    expect(adminRoutes.some((r) => r.path === 'admin')).toBe(true);
  });
});
