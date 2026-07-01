import { Link } from 'react-router-dom';
import { Seo, schema } from '@shared/seo';
import { COMPETITORS } from '@features/marketing/content';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import { Reveal } from '../useReveal';
import { Breadcrumbs, FaqSection } from './shared';
import type { FaqItem } from '../types';

const COMPETITOR_LIST = Object.values(COMPETITORS);

const ANSWER =
  'The best Dockstash alternatives are Backrest (open-source restic UI), SimpleBackups (managed cloud SaaS), Duplicati (GUI backup client), hand-written restic + cron scripts, and provider volume snapshots. Each backs up generically; Dockstash is Docker-project-aware — it dumps each database correctly and drill-tests the restore.';

const HUB_FAQ: FaqItem[] = [
  {
    question: 'What is the closest alternative to Dockstash?',
    answer:
      'Backrest is the closest — it is an excellent open-source restic web UI and scheduler. The gap is that Backrest is not Docker-aware: it backs up host paths, so a live Postgres data directory gets copied instead of dumped, and it has no automated restore-drill.',
  },
  {
    question: 'How do I choose between these backup tools?',
    answer:
      'If your data runs in Docker and you need consistent database dumps plus proof the restore works, choose a Docker-aware tool. If you only back up plain files, a generic restic UI is enough. If you want a fully managed service and will pay for it, a cloud SaaS fits.',
  },
  {
    question: 'Do all of these use restic?',
    answer:
      'Backrest, manual scripts, and Dockstash all use restic, so repositories are portable between them. Duplicati uses its own archive format, and provider snapshots and most cloud SaaS use their own storage layer.',
  },
];

export const AlternativesHub = () => {
  const { locale } = useMarketingRoute();
  const href = (path: string) => localeHref(path, locale);

  const spokePaths = [
    ...COMPETITOR_LIST.map((competitor) => ({
      name: `${competitor.name} alternative`,
      path: localeHref(`/alternatives/${competitor.slug}`, locale),
    })),
    {
      name: 'Dockstash vs Backrest',
      path: localeHref('/vs/backrest', locale),
    },
    {
      name: 'Self-hosted backup vs cloud backup',
      path: localeHref(
        '/compare/self-hosted-backup-vs-cloud-backup',
        locale,
      ),
    },
  ];

  const jsonLd = schema.graph(
    schema.itemList(spokePaths),
    schema.breadcrumbList([
      { name: 'Home', path: localeHref('/', locale) },
      { name: 'Alternatives', path: localeHref('/alternatives', locale) },
    ]),
    schema.faqPage(HUB_FAQ),
  );

  return (
    <>
      <Seo
        title="Dockstash alternatives compared (2026)"
        description="Compare the top Docker backup alternatives — Backrest, SimpleBackups, Duplicati, DIY restic + cron scripts, and provider snapshots — against Dockstash's Docker-aware, verified backups."
        basePath="/alternatives"
        locale={locale}
        jsonLd={jsonLd}
      />

      <div className="mk-container">
        <Breadcrumbs
          crumbs={[{ label: 'Home', basePath: '/' }, { label: 'Alternatives' }]}
          locale={locale}
        />
      </div>

      <section className="mk-section">
        <div className="mk-container">
          <h1 className="mk-h1">Dockstash alternatives</h1>
          <p className="mk-answer">{ANSWER}</p>
        </div>
      </section>

      <Reveal as="section" className="mk-section">
        <div className="mk-container">
          <span className="mk-eyebrow">Comparison</span>
          <h2 className="mk-h2">At a glance</h2>
          <div className="mk-table-wrap">
            <table className="mk-table">
              <thead>
                <tr>
                  <th scope="col">Tool</th>
                  <th scope="col">Category</th>
                  <th scope="col">Pricing</th>
                  <th scope="col">Docker-aware</th>
                </tr>
              </thead>
              <tbody>
                {COMPETITOR_LIST.map((competitor) => (
                  <tr key={competitor.slug}>
                    <th scope="row">
                      <Link to={href(`/alternatives/${competitor.slug}`)}>
                        {competitor.name}
                      </Link>
                    </th>
                    <td>{competitor.category}</td>
                    <td>{competitor.pricing}</td>
                    <td>No — Dockstash is</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className="mk-section">
        <div className="mk-container">
          <h2 className="mk-h2">Compare each alternative</h2>
          <div className="mk-grid">
            {COMPETITOR_LIST.map((competitor) => (
              <Link
                key={competitor.slug}
                to={href(`/alternatives/${competitor.slug}`)}
                className="mk-card"
              >
                <h3>{competitor.name}</h3>
                <p className="mk-muted">{competitor.category}</p>
              </Link>
            ))}
            <Link to={href('/vs/backrest')} className="mk-card">
              <h3>Dockstash vs Backrest</h3>
              <p className="mk-muted">Head-to-head comparison</p>
            </Link>
            <Link
              to={href('/compare/self-hosted-backup-vs-cloud-backup')}
              className="mk-card"
            >
              <h3>Self-hosted vs cloud backup</h3>
              <p className="mk-muted">Category comparison</p>
            </Link>
          </div>
        </div>
      </Reveal>

      <FaqSection faqs={HUB_FAQ} />
    </>
  );
};
