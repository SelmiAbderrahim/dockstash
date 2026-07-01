import { Link } from 'react-router-dom';
import { Seo, schema } from '@shared/seo';
import {
  SERVICE_GUIDES,
  SERVICE_GUIDE_SLUGS,
  USE_CASES,
  USE_CASE_SLUGS,
} from '@features/marketing/content';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import { Breadcrumbs, FaqSection } from './shared';
import { Reveal } from '../useReveal';
import type { FaqItem } from '../types';

const ANSWER =
  'These guides show the correct way to back up each database and app in Docker: dump the database from its running container (never a live file copy), capture the data volumes and config, and store encrypted off-site Restic snapshots. Pick your database engine or your specific app below.';

const HUB_FAQ: FaqItem[] = [
  {
    question: 'Why can’t I just copy the database volume?',
    answer:
      'A running database writes to its data directory constantly. Copying it mid-write captures a torn, inconsistent state that usually will not restore. The correct backup is a logical dump (pg_dumpall, mysqldump --single-transaction, mongodump --oplog) taken from the running container.',
  },
  {
    question: 'What is the difference between a guide and a use-case page?',
    answer:
      'A guide covers one database engine (how to back up PostgreSQL, MySQL, Redis, and so on). A use-case page covers a whole app stack (WordPress, n8n, Supabase) — which databases it runs, which volumes hold files, and the full ordered backup plan.',
  },
  {
    question: 'Does Dockstash automate all of this?',
    answer:
      'Yes. Dockstash scans your Compose project, detects the databases, volumes, and config, runs the correct dump per engine, and stores encrypted Restic snapshots off-site — then drill-tests the restore so you know it works.',
  },
];

export const GuidesHub = () => {
  const { locale } = useMarketingRoute();
  const href = (path: string) => localeHref(path, locale);

  const guideEntries = SERVICE_GUIDE_SLUGS.map((slug) => ({
    name: `Back up ${SERVICE_GUIDES[slug]!.serviceName} in Docker`,
    path: localeHref(`/guides/backup-${slug}-docker`, locale),
  }));
  const useCaseEntries = USE_CASE_SLUGS.map((slug) => ({
    name: `Back up ${USE_CASES[slug]!.appName} in Docker`,
    path: localeHref(`/backup/${slug}-docker`, locale),
  }));

  const jsonLd = schema.graph(
    schema.itemList([...guideEntries, ...useCaseEntries]),
    schema.breadcrumbList([
      { name: 'Home', path: localeHref('/', locale) },
      { name: 'Guides', path: localeHref('/guides', locale) },
    ]),
    schema.faqPage(HUB_FAQ),
  );

  return (
    <>
      <Seo
        title="Docker backup guides for every database & app"
        description="Step-by-step guides to back up any database or app in Docker — PostgreSQL, MySQL, MongoDB, Redis, and app stacks like WordPress and n8n — with consistent dumps and verified restores."
        basePath="/guides"
        locale={locale}
        jsonLd={jsonLd}
      />

      <div className="mk-container">
        <Breadcrumbs
          crumbs={[{ label: 'Home', basePath: '/' }, { label: 'Guides' }]}
          locale={locale}
        />
      </div>

      <section className="mk-section">
        <div className="mk-container">
          <span className="mk-eyebrow">Guides</span>
          <h1 className="mk-h1">Docker backup guides</h1>
          <p className="mk-answer">{ANSWER}</p>
        </div>
      </section>

      <Reveal as="section" className="mk-section">
        <div className="mk-container">
          <span className="mk-eyebrow">By database</span>
          <h2 className="mk-h2">Back up a database in Docker</h2>
          <div className="mk-grid">
            {SERVICE_GUIDE_SLUGS.map((slug) => {
              const guide = SERVICE_GUIDES[slug]!;
              return (
                <Link
                  key={slug}
                  to={href(`/guides/backup-${slug}-docker`)}
                  className="mk-card"
                >
                  <h3>{guide.serviceName}</h3>
                  <p className="mk-muted">Back up {guide.serviceName} in Docker</p>
                </Link>
              );
            })}
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className="mk-section">
        <div className="mk-container">
          <span className="mk-eyebrow">By app stack</span>
          <h2 className="mk-h2">Back up an app stack in Docker</h2>
          <div className="mk-grid">
            {USE_CASE_SLUGS.map((slug) => {
              const app = USE_CASES[slug]!;
              return (
                <Link
                  key={slug}
                  to={href(`/backup/${slug}-docker`)}
                  className="mk-card"
                >
                  <h3>{app.appName}</h3>
                  <p className="mk-muted">{app.category}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </Reveal>

      <FaqSection faqs={HUB_FAQ} />
    </>
  );
};
