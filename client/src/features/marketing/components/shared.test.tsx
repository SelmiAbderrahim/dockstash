import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { initI18n } from '@shared/i18n';
import {
  Breadcrumbs,
  ComparisonTable,
  LastUpdated,
  FaqSection,
  ResponsiveTable,
  TerminalFrame,
} from './shared';

// FaqSection / ComparisonTable / LastUpdated read the URL locale via
// useMarketingT, so they need a router context and the global i18n instance.
beforeEach(() => {
  initI18n({ initialLocale: 'en' });
});

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
    const { rerender } = render(
      <MemoryRouter>
        <LastUpdated iso="2026-07" />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Last updated: July 2026/)).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <LastUpdated iso="2026-99" />
      </MemoryRouter>,
    );
    expect(screen.getByText(/99 2026/)).toBeInTheDocument();
  });

  it('FaqSection renders nothing for an empty list and a list otherwise', () => {
    const { container, rerender } = render(
      <MemoryRouter>
        <FaqSection faqs={[]} />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeNull();
    rerender(
      <MemoryRouter>
        <FaqSection faqs={[{ question: 'q?', answer: 'a' }]} />
      </MemoryRouter>,
    );
    expect(screen.getByText('q?')).toBeInTheDocument();
    expect(screen.getByText(/Frequently asked/)).toBeInTheDocument();
  });

  it('TerminalFrame renders the title bar, decorative dots, and content', () => {
    const { container } = render(
      <TerminalFrame title="dockstash — backup run">
        <pre>hello</pre>
      </TerminalFrame>,
    );
    expect(screen.getByText('dockstash — backup run')).toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
    const dots = container.querySelector('span[aria-hidden="true"]');
    expect(dots).not.toBeNull();
    expect(dots?.children).toHaveLength(3);
  });

  it('ResponsiveTable renders explicit roles, data-labels, and a sm-hidden thead', () => {
    const { container } = render(
      <ResponsiveTable
        columns={[
          { key: 'thing', label: 'Thing' },
          // string label, no labelText → data-label falls back to the label
          { key: 'a', label: 'Column A' },
          // ReactNode label with an explicit labelText
          { key: 'b', label: <em>Column B</em>, labelText: 'B' },
          // ReactNode label without labelText → no data-label at all
          { key: 'c', label: <em>Column C</em> },
        ]}
        rows={[
          { key: 'row-1', header: 'Row one', cells: ['a1', 'b1', 'c1'] },
        ]}
      />,
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(4);
    expect(screen.getByRole('rowheader')).toHaveTextContent('Row one');
    const cells = screen.getAllByRole('cell');
    expect(cells).toHaveLength(3);
    expect(cells[0]).toHaveAttribute('data-label', 'Column A');
    expect(cells[1]).toHaveAttribute('data-label', 'B');
    expect(cells[2]).not.toHaveAttribute('data-label');
    expect(container.querySelector('thead')).toHaveClass('max-sm:hidden');
  });

  it('ComparisonTable keeps its public API on top of ResponsiveTable', () => {
    render(
      <MemoryRouter>
        <ComparisonTable
          competitorName="Backrest"
          rows={[
            {
              feature: 'Restore drills',
              dockstash: 'Yes, automated',
              competitor: 'No',
            },
          ]}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('columnheader', { name: 'Backrest' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Capability' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('rowheader')).toHaveTextContent('Restore drills');
    expect(screen.getByText('Yes, automated')).toHaveAttribute(
      'data-label',
      'Dockstash',
    );
  });
});
