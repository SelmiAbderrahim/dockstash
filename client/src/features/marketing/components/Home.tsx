import { Link } from 'react-router-dom';
import { Seo, schema } from '@shared/seo';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import { SERVICE_GUIDES } from '../content';
import { Reveal } from '../useReveal';
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

// Real, accurate snippet — shows what Dockstash detects and the consistent dump
// it runs for you (no live data-directory copy). Not a mockup: this is the
// actual pg_dumpall path used by the Postgres adapter.
const SHOWCASE = `# Dockstash scans your compose project:
services:
  db:     # postgres:16 → PostgreSQL :5432
  cache:  # redis:7     → Redis (RDB + AOF)
  app:    # your service → volumes + config

# It runs the consistent dump for each engine:
$ pg_dumpall -U "$POSTGRES_USER" \\
    | restic backup --stdin

# …then proves it with a restore drill. ✓`;

// Real signal, not fabricated proof: the database engines Dockstash actually
// supports, sourced from the guide dataset.
const SUPPORTED = Object.values(SERVICE_GUIDES).map((g) => g.serviceName);

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
        title="Docker backup that actually restores — one click for any project"
        description="Dockstash auto-detects and backs up your Docker volumes, databases, and config to encrypted off-site Restic snapshots — with one-click restore and automated restore-drill verification."
        basePath="/"
        locale={locale}
        jsonLd={jsonLd}
      />

      {/* Hero — problem + answer-first block (AEO), product visual alongside */}
      <section className="mk-hero">
        <div className="mk-container mk-container--wide">
          <div className="mk-hero__grid">
            <div>
              <span className="mk-eyebrow">Docker-aware backup &amp; restore</span>
              <h1 className="mk-h1">
                Your Docker projects deserve backups that actually restore
              </h1>
              <p className="mk-answer">{ANSWER}</p>
              <div className="mk-hero__actions">
                <Link
                  to="/register"
                  className="mk-btn mk-btn--primary mk-btn--lg"
                >
                  Start free
                </Link>
                <Link
                  to={href('/guides/backup-postgres-docker')}
                  className="mk-btn mk-btn--lg"
                >
                  See how it works
                </Link>
              </div>
              <div className="mk-badges" aria-label="Supported databases">
                <span className="mk-badge__label">Backs up:</span>
                {SUPPORTED.map((name) => (
                  <span key={name} className="mk-badge">
                    {name}
                  </span>
                ))}
              </div>
            </div>
            <div className="mk-hero__visual" aria-hidden="true">
              <code className="mk-code">{SHOWCASE}</code>
            </div>
          </div>
        </div>
      </section>

      {/* Explain the detection — text only (the snippet lives in the hero) */}
      <Reveal as="section" className="mk-section">
        <div className="mk-container mk-container--wide">
          <span className="mk-eyebrow">From compose file to verified snapshot</span>
          <h2 className="mk-h2">Point it at a project. It figures out the rest.</h2>
          <p className="mk-lede">
            No backup config to write. Dockstash reads your Compose stack,
            detects each engine, runs the correct consistent dump for it, and
            stores an encrypted off-site Restic snapshot — then proves it
            restores with an automated drill.
          </p>
        </div>
      </Reveal>

      {/* Amplify — pain */}
      <Reveal as="section" className="mk-section">
        <div className="mk-container">
          <h2 className="mk-h2">Most homemade Docker backups are broken</h2>
          <div className="mk-grid">
            {[
              {
                h: 'Live-file database copies',
                p: 'Backing up a running Postgres/MySQL data directory captures torn writes. It looks fine until the restore fails.',
              },
              {
                h: 'Silent failures',
                p: 'Cron jobs stop and nobody notices — until recovery day. No alert, no heartbeat, no proof.',
              },
              {
                h: 'Fragile scripts',
                p: 'Hand-rolled restic + cron + pg_dump breaks on a version bump and has no restore verification.',
              },
            ].map((card, i) => (
              <Reveal key={card.h} className="mk-card mk-card--surface" index={i}>
                <h3>{card.h}</h3>
                <p className="mk-muted">{card.p}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Solution — how it works */}
      <Reveal as="section" className="mk-section">
        <div className="mk-container mk-container--wide">
          <span className="mk-eyebrow">How it works</span>
          <h2 className="mk-h2">Scan, back up, verify</h2>
          <ol className="mk-steps">
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
          <p style={{ marginTop: 20 }}>
            <Link to={href('/alternatives/backrest')}>
              Compared to Backrest and DIY scripts →
            </Link>
          </p>
        </div>
      </Reveal>

      {/* Trust — differentiators */}
      <Reveal as="section" className="mk-section">
        <div className="mk-container">
          <span className="mk-eyebrow">Why teams trust Dockstash</span>
          <h2 className="mk-h2">Verified restores, your storage, no lock-in</h2>
          <div className="mk-grid">
            {[
              {
                h: 'Docker-aware',
                p: 'Knows a Postgres container needs a pg_dumpall, not a file copy.',
              },
              {
                h: 'Verified restores',
                p: 'Automated restore-drill diffs prove your backups are real.',
              },
              {
                h: 'Your storage, no lock-in',
                p: 'Standard Restic repos on your own VPS. Restore without us.',
              },
              {
                h: 'Encrypted secrets',
                p: 'AES-256-GCM at rest; SSH host-key pinning on the backup channel.',
              },
            ].map((card, i) => (
              <Reveal key={card.h} className="mk-card" index={i}>
                <h3>{card.h}</h3>
                <p className="mk-muted">{card.p}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </Reveal>

      <FaqSection faqs={HOME_FAQ} />

      {/* Closing CTA */}
      <section className="mk-cta-band">
        <div className="mk-container mk-cta-band__inner">
          <h2 className="mk-h2">Back up your first Docker project in minutes</h2>
          <p className="mk-lede" style={{ margin: '0 auto' }}>
            Free and fully self-hosted to start — no card, your storage, your keys.
          </p>
          <div className="mk-hero__actions">
            <Link to="/register" className="mk-btn mk-btn--primary mk-btn--lg">
              Start free
            </Link>
            <Link to={href('/pricing')} className="mk-btn mk-btn--lg">
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};
