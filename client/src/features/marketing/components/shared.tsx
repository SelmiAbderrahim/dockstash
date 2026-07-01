import { Link } from 'react-router-dom';
import type { SupportedLocale } from '@shared/i18n';
import type { FaqItem, ComparisonRow } from '../types';
import { localeHref } from '../useMarketingRoute';

export interface Crumb {
  label: string;
  /** Un-prefixed base path; omit for the current (last) crumb. */
  basePath?: string;
}

export const Breadcrumbs = ({
  crumbs,
  locale,
}: {
  crumbs: Crumb[];
  locale: SupportedLocale;
}) => (
  <nav className="mk-breadcrumbs" aria-label="Breadcrumb">
    {crumbs.map((crumb, index) => {
      const last = index === crumbs.length - 1;
      return (
        <span key={index} style={{ margin: 0 }}>
          {crumb.basePath && !last ? (
            <Link to={localeHref(crumb.basePath, locale)}>{crumb.label}</Link>
          ) : (
            <span aria-current={last ? 'page' : undefined}>{crumb.label}</span>
          )}
          {!last && <span aria-hidden="true">/</span>}
        </span>
      );
    })}
  </nav>
);

export const FaqSection = ({ faqs }: { faqs: FaqItem[] }) => {
  if (faqs.length === 0) return null;
  return (
    <section className="mk-section">
      <div className="mk-container">
        <h2 className="mk-h2">Frequently asked questions</h2>
        <div className="mk-faq">
          {faqs.map((faq) => (
            <div key={faq.question} className="mk-faq__item">
              <h3>{faq.question}</h3>
              <p className="mk-muted">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export const ComparisonTable = ({
  rows,
  competitorName,
}: {
  rows: ComparisonRow[];
  competitorName: string;
}) => (
  <table className="mk-table">
    <thead>
      <tr>
        <th scope="col">Capability</th>
        <th scope="col">Dockstash</th>
        <th scope="col">{competitorName}</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr key={row.feature}>
          <th scope="row">{row.feature}</th>
          <td>{row.dockstash}</td>
          <td>{row.competitor}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export const CodeBlock = ({ children }: { children: string }) => (
  <code className="mk-code">{children}</code>
);

/** Visible "Last updated" recency signal (AEO). `iso` = "2026-07". */
export const LastUpdated = ({ iso }: { iso: string }) => {
  const [year, month] = iso.split('-');
  const monthName = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ][Number(month) - 1] ?? month;
  return (
    <p className="mk-muted" style={{ fontSize: 14 }}>
      Last updated: {monthName} {year}
    </p>
  );
};
