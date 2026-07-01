import { Link } from 'react-router-dom';
import { Seo, schema } from '@shared/seo';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import { SERVICE_GUIDES } from '../content';
import { Reveal } from '../useReveal';
import {
  Container,
  Eyebrow,
  FaqSection,
  cardClass,
  codeClass,
  h1Class,
  h2Class,
  sectionClass,
} from './shared';
import { cn } from '@shared/lib/utils';
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

const stepBadgeClass =
  'inline-flex size-7 items-center justify-center rounded-md border bg-muted text-sm font-bold text-primary';

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
      <section className="border-b border-border py-16 sm:py-24">
        <Container wide>
          <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
            <div>
              <Eyebrow>Docker-aware backup &amp; restore</Eyebrow>
              <h1 className={h1Class}>
                Your Docker projects deserve backups that actually restore
              </h1>
              <p className="max-w-[720px] rounded-lg border border-border bg-muted p-5 text-lg leading-relaxed">
                {ANSWER}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/register">Start free</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to={href('/guides/backup-postgres-docker')}>
                    See how it works
                  </Link>
                </Button>
              </div>
              <div
                className="mt-7 flex flex-wrap items-center gap-2"
                aria-label="Supported databases"
              >
                <span className="text-sm font-medium text-muted-foreground">
                  Backs up:
                </span>
                {SUPPORTED.map((name) => (
                  <Badge key={name} variant="outline" className="font-medium">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="hidden min-w-0 lg:block" aria-hidden="true">
              <code className={codeClass}>{SHOWCASE}</code>
            </div>
          </div>
        </Container>
      </section>

      {/* Explain the detection — text only (the snippet lives in the hero) */}
      <Reveal as="section" className={sectionClass}>
        <Container wide>
          <Eyebrow>From compose file to verified snapshot</Eyebrow>
          <h2 className={h2Class}>Point it at a project. It figures out the rest.</h2>
          <p className="max-w-[680px] text-lg text-muted-foreground">
            No backup config to write. Dockstash reads your Compose stack,
            detects each engine, runs the correct consistent dump for it, and
            stores an encrypted off-site Restic snapshot — then proves it
            restores with an automated drill.
          </p>
        </Container>
      </Reveal>

      {/* Amplify — pain */}
      <Reveal as="section" className={sectionClass}>
        <Container>
          <h2 className={h2Class}>Most homemade Docker backups are broken</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
              <Reveal key={card.h} className={cn(cardClass, 'space-y-2')} index={i}>
                <h3 className="text-lg font-semibold tracking-tight">{card.h}</h3>
                <p className="text-muted-foreground">{card.p}</p>
              </Reveal>
            ))}
          </div>
        </Container>
      </Reveal>

      {/* Solution — how it works */}
      <Reveal as="section" className={sectionClass}>
        <Container wide>
          <Eyebrow>How it works</Eyebrow>
          <h2 className={h2Class}>Scan, back up, verify</h2>
          <ol className="grid list-none gap-4 p-0 sm:grid-cols-3">
            <li className={cn(cardClass, 'space-y-2.5')}>
              <span className={stepBadgeClass}>1</span>
              <p>
                <strong className="font-semibold text-foreground">Scan.</strong>{' '}
                Dockstash reads your Compose project and detects databases,
                volumes, and reverse-proxy config.
              </p>
            </li>
            <li className={cn(cardClass, 'space-y-2.5')}>
              <span className={stepBadgeClass}>2</span>
              <p>
                <strong className="font-semibold text-foreground">
                  Back up.
                </strong>{' '}
                Each database is dumped consistently from its container, then
                Restic snapshots the dump + files off-site, encrypted.
              </p>
            </li>
            <li className={cn(cardClass, 'space-y-2.5')}>
              <span className={stepBadgeClass}>3</span>
              <p>
                <strong className="font-semibold text-foreground">
                  Verify.
                </strong>{' '}
                Automated restore drills restore to a scratch location and diff
                against source, so you know it works.
              </p>
            </li>
          </ol>
          <p className="mt-5">
            <Link
              to={href('/alternatives/backrest')}
              className="text-primary underline-offset-4 hover:underline"
            >
              Compared to Backrest and DIY scripts →
            </Link>
          </p>
        </Container>
      </Reveal>

      {/* Trust — differentiators */}
      <Reveal as="section" className={sectionClass}>
        <Container>
          <Eyebrow>Why teams trust Dockstash</Eyebrow>
          <h2 className={h2Class}>Verified restores, your storage, no lock-in</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
              <Reveal key={card.h} className={cn(cardClass, 'space-y-2')} index={i}>
                <h3 className="text-lg font-semibold tracking-tight">{card.h}</h3>
                <p className="text-muted-foreground">{card.p}</p>
              </Reveal>
            ))}
          </div>
        </Container>
      </Reveal>

      <FaqSection faqs={HOME_FAQ} />

      {/* Closing CTA */}
      <section className="py-14 text-center sm:py-20">
        <Container className="max-w-xl">
          <h2 className={h2Class}>Back up your first Docker project in minutes</h2>
          <p className="mx-auto max-w-prose text-lg text-muted-foreground">
            Free and fully self-hosted to start — no card, your storage, your keys.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/register">Start free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to={href('/pricing')}>See pricing</Link>
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
};
