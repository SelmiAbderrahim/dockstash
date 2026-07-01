import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminDashboard, adminRoutes } from './index';

describe('admin feature', () => {
  it('renders the admin dashboard placeholder', () => {
    render(<AdminDashboard />);
    expect(screen.getByText(/admin navigation/i)).toBeInTheDocument();
  });

  it('exposes an /admin route', () => {
    expect(adminRoutes.some((r) => r.path === 'admin')).toBe(true);
  });
});
