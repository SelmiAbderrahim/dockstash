import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@shared/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/ui/table';
import type { SupportedLocale } from '@shared/i18n';
import type { FaqItem, ComparisonRow } from '../types';
import { localeHref } from '../useMarketingRoute';

// ── Shared layout primitives (marketing feature only) ───────────────────────
// Reusable Tailwind class strings and small wrappers so the 13 marketing pages
// stay visually consistent without duplicating utility strings everywhere.
// All logical (RTL-safe) utilities: no pl-/pr-/text-left.

/** Section band: vertical rhythm + a hairline divider between sections. */
export const sectionClass = 'border-b border-border py-14 sm:py-20';

/** Page hero title. */
export const h1Class =
  'mb-4 max-w-[20ch] text-4xl font-bold leading-tight tracking-tight sm:text-5xl';

/** Section heading. */
export const h2Class =
  'mb-4 text-2xl font-bold leading-tight tracking-tight sm:text-3xl';

/** Answer-first extract block (AEO target). */
export const answerClass =
  'max-w-[720px] rounded-lg border border-border bg-muted p-5 text-lg leading-relaxed';

/** Flat card surface, matching the shadcn Card visual language. */
export const cardClass =
  'rounded-xl border bg-card p-6 text-card-foreground shadow-sm';

/** Monospace code block. */
export const codeClass =
  'block overflow-x-auto whitespace-pre rounded-lg border bg-muted p-4 font-mono text-[13.5px] leading-relaxed [tab-size:2]';

/** Centred, max-width content column. `wide` widens it for the hero. */
export const Container = ({
  wide = false,
  className,
  children,
}: {
  wide?: boolean;
  className?: string;
  children: ReactNode;
}) => (
  <div
    className={cn(
      'mx-auto w-full px-5',
      wide ? 'max-w-6xl' : 'max-w-5xl',
      className,
    )}
  >
    {children}
  </div>
);

/** Small uppercase label above a heading — hierarchy, not decoration. */
export const Eyebrow = ({ children }: { children: ReactNode }) => (
  <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-wide text-primary">
    {children}
  </span>
);

/** Clickable navigational card (whole card is a link). */
export const LinkCard = ({
  to,
  title,
  description,
}: {
  to: string;
  title: ReactNode;
  description: ReactNode;
}) => (
  <Link
    to={to}
    className={cn(
      cardClass,
      'block transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    )}
  >
    <h3 className="mb-1 text-lg font-semibold tracking-tight">{title}</h3>
    <p className="text-sm text-muted-foreground">{description}</p>
  </Link>
);

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
  <nav
    className="flex flex-wrap items-center gap-1 pt-5 text-sm text-muted-foreground"
    aria-label="Breadcrumb"
  >
    {crumbs.map((crumb, index) => {
      const last = index === crumbs.length - 1;
      return (
        <span key={index} className="inline-flex items-center gap-1">
          {crumb.basePath && !last ? (
            <Link
              to={localeHref(crumb.basePath, locale)}
              className="transition-colors hover:text-foreground"
            >
              {crumb.label}
            </Link>
          ) : (
            <span
              className={last ? 'text-foreground' : undefined}
              aria-current={last ? 'page' : undefined}
            >
              {crumb.label}
            </span>
          )}
          {!last && (
            <span aria-hidden="true" className="px-1 text-muted-foreground/60">
              /
            </span>
          )}
        </span>
      );
    })}
  </nav>
);

export const FaqSection = ({ faqs }: { faqs: FaqItem[] }) => {
  if (faqs.length === 0) return null;
  return (
    <section className={sectionClass}>
      <Container>
        <h2 className={h2Class}>Frequently asked questions</h2>
        <div className="mt-6 divide-y divide-border border-t border-border">
          {faqs.map((faq) => (
            <div key={faq.question} className="py-4">
              <h3 className="mb-1.5 text-lg font-semibold tracking-tight">
                {faq.question}
              </h3>
              <p className="max-w-prose text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </div>
      </Container>
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
  <Table className="border">
    <TableHeader>
      <TableRow>
        <TableHead scope="col" className="text-start align-top">
          Capability
        </TableHead>
        <TableHead scope="col" className="text-start align-top">
          Dockstash
        </TableHead>
        <TableHead scope="col" className="text-start align-top">
          {competitorName}
        </TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {rows.map((row) => (
        <TableRow key={row.feature}>
          <TableHead
            scope="row"
            className="whitespace-normal text-start align-top font-medium"
          >
            {row.feature}
          </TableHead>
          <TableCell className="whitespace-normal align-top">
            {row.dockstash}
          </TableCell>
          <TableCell className="whitespace-normal align-top">
            {row.competitor}
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export const CodeBlock = ({ children }: { children: string }) => (
  <code className={codeClass}>{children}</code>
);

export interface LegalSectionDef {
  id: string;
  title: string;
  body: ReactNode;
}

/**
 * Numbered anchor list + section stack for the legal pages (/privacy, /terms).
 * Each section gets an `id` so ?tab-free deep links like /terms#billing work.
 */
export const LegalSections = ({ sections }: { sections: LegalSectionDef[] }) => (
  <>
    <nav aria-label="Table of contents" className="mb-12">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground">
        Contents
      </h2>
      <ol className="list-decimal space-y-1 ps-5 text-sm">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {section.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
    <div className="space-y-12">
      {sections.map((section, index) => (
        <section key={section.id} id={section.id} className="scroll-mt-24">
          <h2 className={h2Class}>
            {index + 1}. {section.title}
          </h2>
          <div className="max-w-prose space-y-4 text-muted-foreground [&_li]:mt-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:ps-5">
            {section.body}
          </div>
        </section>
      ))}
    </div>
  </>
);

/** Visible "Last updated" recency signal (AEO). `iso` = "2026-07". */
export const LastUpdated = ({ iso }: { iso: string }) => {
  const [year, month] = iso.split('-');
  const monthName = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ][Number(month) - 1] ?? month;
  return (
    <p className="mt-4 text-sm text-muted-foreground">
      Last updated: {monthName} {year}
    </p>
  );
};
