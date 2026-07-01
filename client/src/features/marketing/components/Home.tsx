import { Link } from 'react-router-dom';
import { Seo, schema } from '@shared/seo';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import { FaqSection } from './shared';
import type { FaqItem } from '../types';

const HOME_FAQ: FaqItem[] = [
  {
    question: 'How does Dockstash back up a Docker database?',
    answer:
      'Dockstash runs the database’s native dump inside the running container (pg_dumpall, mysqldump --single-transaction, or mongodump --oplog), then stores the dump as an encrypted Restic snapshot. It never copies live database files off disk, because a half-written data file cannot be restored.',
  },
  {
    question: 'Where are my backups stored?',
    answer:
      'On your own storage VPS over SSH, as standard encrypted Restic repositories. Dockstash never holds your data. The Free tier runs entirely self-hosted with no paid provider.',
  },
  {
    question: 'How do I know a backup will actually restore?',
    answer:
      'Dockstash runs automated restore drills: it restores the latest snapshot to a scratch location and diffs it against the source, then surfaces per-project drill status. An untested backup is treated as no backup.',
  },
  {
    question: 'Do I need to write a backup config?',
    answer:
      'No. Dockstash scans your Docker Compose project, detects databases, volumes, and reverse-proxy config, and proposes a plan you confirm with checkboxes. One click backs everything up.',
  },
];

const ANSWER =
  'Dockstash makes backing up any Docker project one click. It auto-detects your volumes, databases, and config, dumps each database consistently from its running container, and stores encrypted Restic snapshots off-site — with automated restore drills that prove the backup works.';

export const Home = () => {
  const { locale } = useMarketingRoute();
  const href = (path: string) => localeHref(path, locale);

  const jsonLd = schema.graph(
    schema.organization(),
    schema.website(),
    schema.softwareApplication([{ name: 'Free', price: '0' }]),
    schema.faqPage(HOME_FAQ),
  );

  return (
    <>
      <Seo
        title="One-click backups for any Docker project"
        description="Dockstash auto-detects and backs up your Docker volumes, databases, and config to encrypted off-site Restic snapshots — with one-click restore and automated restore-drill verification."
        basePath="/"
        locale={locale}
        jsonLd={jsonLd}
      />

      {/* Hero (Problem + answer-first block for AEO) */}
      <section className="mk-section">
        <div className="mk-container">
          <h1 className="mk-h1">
            Your Docker projects deserve backups that actually restore
          </h1>
          <p className="mk-answer">{ANSWER}</p>
          <p style={{ marginTop: 24 }}>
            <Link to="/register" className="mk-btn mk-btn--primary">
              Start free
            </Link>{' '}
            <Link to={href('/guides/backup-postgres-docker')} className="mk-btn">
              See how it works
            </Link>
          </p>
        </div>
      </section>

      {/* Amplify — pain */}
      <section className="mk-section">
        <div className="mk-container">
          <h2 className="mk-h2">Most homemade Docker backups are broken</h2>
          <div className="mk-grid">
            <div className="mk-card">
              <h3>Live-file database copies</h3>
              <p className="mk-muted">
                Backing up a running Postgres/MySQL data directory captures torn
                writes. It looks fine until the restore fails.
              </p>
            </div>
            <div className="mk-card">
              <h3>Silent failures</h3>
              <p className="mk-muted">
                Cron jobs stop and nobody notices — until recovery day. No
                alert, no heartbeat, no proof.
              </p>
            </div>
            <div className="mk-card">
              <h3>Fragile scripts</h3>
              <p className="mk-muted">
                Hand-rolled restic + cron + pg_dump breaks on a version bump and
                has no restore verification.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution — how it works */}
      <section className="mk-section">
        <div className="mk-container">
          <h2 className="mk-h2">How Dockstash works</h2>
          <ol>
            <li>
              <strong>Scan.</strong> Dockstash reads your Compose project and
              detects databases, volumes, and reverse-proxy config.
            </li>
            <li>
              <strong>Back up.</strong> Each database is dumped consistently from
              its container, then Restic snapshots the dump + files off-site,
              encrypted.
            </li>
            <li>
              <strong>Verify.</strong> Automated restore drills restore to a
              scratch location and diff against source, so you know it works.
            </li>
          </ol>
          <p>
            <Link to={href('/alternatives/backrest')}>
              Compared to Backrest and DIY scripts →
            </Link>
          </p>
        </div>
      </section>

      {/* Trust — differentiators */}
      <section className="mk-section">
        <div className="mk-container">
          <h2 className="mk-h2">Why teams trust Dockstash</h2>
          <div className="mk-grid">
            <div className="mk-card">
              <h3>Docker-aware</h3>
              <p className="mk-muted">
                Knows a Postgres container needs a pg_dumpall, not a file copy.
              </p>
            </div>
            <div className="mk-card">
              <h3>Verified restores</h3>
              <p className="mk-muted">
                Automated restore-drill diffs prove your backups are real.
              </p>
            </div>
            <div className="mk-card">
              <h3>Your storage, no lock-in</h3>
              <p className="mk-muted">
                Standard Restic repos on your own VPS. Restore without us.
              </p>
            </div>
            <div className="mk-card">
              <h3>Encrypted secrets</h3>
              <p className="mk-muted">
                AES-256-GCM at rest; SSH host-key pinning on the backup channel.
              </p>
            </div>
          </div>
          <p style={{ marginTop: 24 }}>
            <Link to={href('/pricing')} className="mk-btn mk-btn--primary">
              See pricing
            </Link>{' '}
            <Link to={href('/security')} className="mk-btn">
              How we secure your data
            </Link>
          </p>
        </div>
      </section>

      <FaqSection faqs={HOME_FAQ} />
    </>
  );
};
