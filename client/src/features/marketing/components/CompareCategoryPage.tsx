import { Link } from 'react-router-dom';
import { Seo, schema } from '@shared/seo';
import { getCompetitor } from '@features/marketing/content';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import { Breadcrumbs, FaqSection } from './shared';
import { Reveal } from '../useReveal';
import type { ComparisonRow, FaqItem } from '../types';

const BASE_PATH = '/compare/self-hosted-backup-vs-cloud-backup';

const ANSWER =
  'Self-hosted backup keeps your data, keys, and pipeline entirely on infrastructure you own — no recurring per-source fee and no third party in the data path. Cloud backup SaaS trades that sovereignty for a hands-off managed service. Dockstash is self-hosted: backups run on your VPS and land on your storage as encrypted Restic repos.';

const ROWS: ComparisonRow[] = [
  {
    feature: 'Data sovereignty',
    dockstash: 'You hold the repos and keys; nothing transits a vendor',
    competitor: 'Backup pipeline and credentials flow through a third-party SaaS',
    dockstashWins: true,
  },
  {
    feature: 'Cost model',
    dockstash: 'Free self-host tier; flat paid tiers for scale',
    competitor: 'Recurring subscription that scales with sources',
    dockstashWins: true,
  },
  {
    feature: 'Control',
    dockstash: 'Runs on your VPS → your storage VPS over SSH',
    competitor: 'Orchestrated by the provider’s platform',
    dockstashWins: true,
  },
  {
    feature: 'Restore verification',
    dockstash: 'Automated restore-drill diff against source',
    competitor: 'Backup monitoring and notifications',
    dockstashWins: true,
  },
  {
    feature: 'Setup effort',
    dockstash: 'Self-host the agent, then auto-scan and confirm',
    competitor: 'No self-hosting — sign up and connect',
  },
  {
    feature: 'Vendor continuity risk',
    dockstash: 'Standard Restic repos restore without any vendor',
    competitor: 'You depend on the service staying online and in business',
    dockstashWins: true,
  },
];

const FAQ: FaqItem[] = [
  {
    question: 'Is self-hosted backup safer than cloud backup?',
    answer:
      'Safer for data sovereignty: with self-hosted backup your keys and repositories never leave infrastructure you control, so no third party sits in the data path. Cloud backup is safer in the sense that a team operates it for you — the tradeoff is control versus convenience.',
  },
  {
    question: 'Does self-hosted backup cost less than cloud backup SaaS?',
    answer:
      'Usually, over time. A self-hosted tool like Dockstash has a free tier and stores to a storage VPS you already pay for, avoiding per-source SaaS fees that grow with usage. You trade recurring subscription cost for a little setup effort.',
  },
  {
    question: 'Can I restore if my backup vendor disappears?',
    answer:
      'With self-hosted Restic repositories, yes — point the restic CLI at your storage VPS and restore with no vendor involved. With a cloud SaaS, restore typically depends on the provider’s platform being available.',
  },
  {
    question: 'When does cloud backup SaaS make more sense?',
    answer:
      'When you want a fully managed service with support, need broad non-Docker source coverage, and are happy to pay a subscription and route backups through a third-party platform. Teams that want everything on their own infrastructure should self-host.',
  },
];

export const CompareCategoryPage = () => {
  const { locale } = useMarketingRoute();
  const href = (path: string) => localeHref(path, locale);
  const cloud = getCompetitor('simplebackups');

  const jsonLd = schema.graph(
    schema.breadcrumbList([
      { name: 'Home', path: localeHref('/', locale) },
      { name: 'Alternatives', path: localeHref('/alternatives', locale) },
      {
        name: 'Self-hosted vs cloud backup',
        path: localeHref(BASE_PATH, locale),
      },
    ]),
    schema.faqPage(FAQ),
  );

  return (
    <>
      <Seo
        title="Self-hosted backup vs cloud backup (2026)"
        description="Self-hosted backup vs cloud backup SaaS compared on data sovereignty, cost, control, and restore. When to keep backups on your own storage, and when a managed cloud service fits."
        basePath={BASE_PATH}
        locale={locale}
        jsonLd={jsonLd}
      />

      <div className="mk-container">
        <Breadcrumbs
          crumbs={[
            { label: 'Home', basePath: '/' },
            { label: 'Alternatives', basePath: '/alternatives' },
            { label: 'Self-hosted vs cloud' },
          ]}
          locale={locale}
        />
      </div>

      <section className="mk-section">
        <div className="mk-container">
          <h1 className="mk-h1">
            Self-hosted backup vs cloud backup
          </h1>
          <p className="mk-answer">{ANSWER}</p>
        </div>
      </section>

      <Reveal as="section" className="mk-section">
        <div className="mk-container">
          <span className="mk-eyebrow">Head to head</span>
          <h2 className="mk-h2">Side by side</h2>
          <div className="mk-table-wrap">
            <table className="mk-table">
              <thead>
                <tr>
                  <th scope="col">Dimension</th>
                  <th scope="col">Self-hosted (Dockstash)</th>
                  <th scope="col">Cloud backup SaaS</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.feature}>
                    <th scope="row">{row.feature}</th>
                    <td>{row.dockstash}</td>
                    <td>{row.competitor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className="mk-section">
        <div className="mk-container">
          <h2 className="mk-h2">When to pick each</h2>
          <div className="mk-grid">
            <div className="mk-card">
              <h3>Pick self-hosted backup</h3>
              <p className="mk-muted">
                You want backups that stay entirely on your own infrastructure,
                with no recurring per-source fee and no third party in the data
                path — and you run your workloads in Docker.
              </p>
            </div>
            <div className="mk-card">
              <h3>Pick cloud backup SaaS</h3>
              <p className="mk-muted">
                {cloud
                  ? cloud.bestFor
                  : 'You want a hands-off managed service and are happy to pay a subscription and route backups through a third-party platform.'}
              </p>
            </div>
          </div>
          <p style={{ marginTop: 24 }}>
            <Link to="/register" className="mk-btn mk-btn--primary">
              Start free, self-hosted
            </Link>{' '}
            <Link to={href('/alternatives/simplebackups')} className="mk-btn">
              Dockstash vs a cloud backup SaaS
            </Link>
          </p>
        </div>
      </Reveal>

      <FaqSection faqs={FAQ} />
    </>
  );
};
