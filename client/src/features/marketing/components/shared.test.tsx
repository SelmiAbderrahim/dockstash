import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Breadcrumbs, LastUpdated, FaqSection } from './shared';

describe('marketing shared components', () => {
  it('Breadcrumbs renders links, plain crumbs, and the current page', () => {
    render(
      <MemoryRouter>
        <Breadcrumbs
          locale="en"
          crumbs={[
            { label: 'Home', basePath: '/' }, // linked, non-last
            { label: 'Section' }, // no basePath, non-last → plain span
            { label: 'Current', basePath: '/current' }, // last → span, aria-current=page
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByText('Section')).toBeInTheDocument();
    const current = screen.getByText('Current');
    expect(current).toHaveAttribute('aria-current', 'page');
  });

  it('LastUpdated names a valid month and falls back for an invalid one', () => {
    const { rerender } = render(<LastUpdated iso="2026-07" />);
    expect(screen.getByText(/July 2026/)).toBeInTheDocument();
    rerender(<LastUpdated iso="2026-99" />);
    expect(screen.getByText(/99 2026/)).toBeInTheDocument();
  });

  it('FaqSection renders nothing for an empty list and a list otherwise', () => {
    const { container, rerender } = render(<FaqSection faqs={[]} />);
    expect(container.firstChild).toBeNull();
    rerender(<FaqSection faqs={[{ question: 'q?', answer: 'a' }]} />);
    expect(screen.getByText('q?')).toBeInTheDocument();
  });
});
