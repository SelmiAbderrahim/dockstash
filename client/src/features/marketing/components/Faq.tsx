import { Seo, schema } from '@shared/seo';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import { Breadcrumbs, FaqSection } from './shared';
import type { FaqItem } from '../types';

const ANSWER =
  'Dockstash is a self-hostable, Docker-aware backup orchestrator. It auto-detects your Compose stack, dumps each database the correct way from its running container, stores encrypted Restic snapshots on your own storage VPS, and drill-tests the restore. Below are the questions we hear most.';

const SITE_FAQ: FaqItem[] = [
  {
    question: 'What does Dockstash actually do?',
    answer:
      'It runs on your production VPS, scans your Docker Compose projects, and detects every backup-able layer — volumes, databases, compose/.env, and reverse-proxy config. It dumps databases consistently from the running container, then stores encrypted Restic snapshots off-site over SSH with automated restore-drill verification.',
  },
  {
    question: 'Why not just use Backrest?',
    answer:
      'Backrest is a solid generic restic UI, but it does not know your database needs a pg_dumpall rather than a file copy, it does not detect your Compose stack, and it will not drill-test restores. Dockstash is Docker-project-aware and verifies recovery.',
  },
  {
    question: 'Why not write my own restic + cron script?',
    answer:
      'You can — and then maintain it, hope the database dumps stay consistent through version bumps, and notice when cron silently stops. Dockstash is that script, hardened, alerted, verified, and reduced to one click.',
  },
  {
    question: 'Is my data safe with Dockstash?',
    answer:
      'On the Free/self-host tier everything runs on your own servers and backups land on your storage VPS — we never hold your data. Secrets are AES-256-GCM encrypted at rest and Restic repositories are encrypted with your own key.',
  },
  {
    question: 'What happens if Dockstash shuts down?',
    answer:
      'Your repositories are standard Restic. Point the restic CLI at your storage VPS and restore without us. Config export/import is included, so there is zero lock-in.',
  },
  {
    question: 'How do I know my backups will actually restore?',
    answer:
      'Dockstash runs automated restore drills: it restores the latest snapshot to a scratch location, diffs it against the source, and surfaces per-project drill status. An untested backup is treated as no backup.',
  },
  {
    question: 'Which databases does Dockstash support?',
    answer:
      'Docker-aware adapters cover PostgreSQL, MySQL, MariaDB, MongoDB, Redis, Valkey, SQLite, ClickHouse, Elasticsearch, RabbitMQ, MinIO, InfluxDB, and Neo4j — each dumped the correct, consistent way for its engine.',
  },
  {
    question: 'Do I need to write a backup config file?',
    answer:
      'No. Dockstash scans your Compose project, detects databases, volumes, and reverse-proxy config, and proposes a plan you confirm with checkboxes. One click backs everything up — no YAML to author.',
  },
  {
    question: 'Where are my backups stored?',
    answer:
      'On your own storage VPS over SSH, as standard encrypted Restic repositories. The Free tier runs entirely self-hosted with no paid provider, so nothing transits a third party.',
  },
  {
    question: 'How much does Dockstash cost?',
    answer:
      'The Free tier is $0 for one self-hosted project. Pro adds 10 projects, hourly backups, and email alerts; Business is unlimited projects with priority support and multi-VPS. Yearly billing gives you two months free.',
  },
];

export const Faq = () => {
  const { locale } = useMarketingRoute();

  const jsonLd = schema.graph(
    schema.faqPage(SITE_FAQ),
    schema.breadcrumbList([
      { name: 'Home', path: localeHref('/', locale) },
      { name: 'FAQ', path: localeHref('/faq', locale) },
    ]),
  );

  return (
    <>
      <Seo
        title="Dockstash FAQ — Docker backup questions"
        description="Answers to common questions about Dockstash: how it backs up Docker databases, where backups are stored, security, pricing, restore verification, and avoiding lock-in."
        basePath="/faq"
        locale={locale}
        jsonLd={jsonLd}
      />

      <div className="mk-container">
        <Breadcrumbs
          crumbs={[{ label: 'Home', basePath: '/' }, { label: 'FAQ' }]}
          locale={locale}
        />
      </div>

      <section className="mk-section">
        <div className="mk-container">
          <span className="mk-eyebrow">FAQ</span>
          <h1 className="mk-h1">Frequently asked questions</h1>
          <p className="mk-answer">{ANSWER}</p>
        </div>
      </section>

      <FaqSection faqs={SITE_FAQ} />
    </>
  );
};
