import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MarketingFooter } from './MarketingFooter';

describe('MarketingFooter', () => {
  it('renders tagline + copyright + one nav per column', () => {
    render(
      <MemoryRouter>
        <MarketingFooter
          tagline="Backup for Docker"
          copyright="© 2026 Dockstash"
          localeSwitcher={<span data-testid="ls">ls</span>}
          columns={[
            {
              ariaLabel: 'Product',
              heading: 'Product',
              links: [{ to: '/pricing', label: 'Pricing' }],
            },
            {
              ariaLabel: 'Legal',
              heading: 'Legal',
              links: [{ to: '/privacy', label: 'Privacy' }],
            },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Backup for Docker')).toBeInTheDocument();
    expect(screen.getByText(/© 2026 Dockstash/)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Product' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Legal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pricing' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy' })).toBeInTheDocument();
    expect(screen.getByTestId('ls')).toBeInTheDocument();
  });

  it('handles empty column list without throwing', () => {
    render(
      <MemoryRouter>
        <MarketingFooter
          tagline="Tag"
          copyright="© 2026"
          localeSwitcher={null}
          columns={[]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Tag')).toBeInTheDocument();
  });
});
