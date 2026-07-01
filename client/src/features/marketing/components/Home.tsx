import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  BellRingIcon,
  DatabaseIcon,
  HardDriveIcon,
  LockIcon,
  ScanSearchIcon,
  ShieldCheckIcon,
} from 'lucide-react';
import { Seo, schema } from '@shared/seo';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import { SERVICE_GUIDES } from '../content';
import { Reveal } from '../useReveal';
import {
  CheckItem,
  Container,
  Eyebrow,
  FaqSection,
  FeatureCard,
  InvertedBand,
  Serif,
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

const FEATURES = [
  {
    icon: <ScanSearchIcon />,
    title: 'Compose-aware detection',
    body: 'Reads your Docker Compose stack and detects databases, volumes, and reverse-proxy config — no backup config to write.',
  },
  {
    icon: <DatabaseIcon />,
    title: 'Consistent database dumps',
    body: 'Runs each engine’s native dump inside the running container. Never a torn live-file copy that fails on restore day.',
  },
  {
    icon: <ShieldCheckIcon />,
    title: 'Verified restore drills',
    body: 'Restores the latest snapshot to a scratch location and diffs it against the source. Proof, not hope.',
  },
  {
    icon: <HardDriveIcon />,
    title: 'Your storage, no lock-in',
    body: 'Standard encrypted Restic repositories on your own VPS over SSH. You can restore without Dockstash.',
  },
  {
    icon: <LockIcon />,
    title: 'Encrypted end to end',
    body: 'AES-256-GCM secrets at rest, SSH host-key pinning on the backup channel, Restic encryption in the repo.',
  },
  {
    icon: <BellRingIcon />,
    title: 'Heartbeats & alerts',
    body: 'Silent cron death is the classic backup failure. Dockstash alerts you when a backup stops happening.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Scan',
    body: 'Point Dockstash at a Compose project. It detects databases, volumes, and reverse-proxy config and proposes a plan you confirm.',
  },
  {
    n: '02',
    title: 'Back up',
    body: 'Each database is dumped consistently from its container, then Restic snapshots the dump and files off-site, encrypted.',
  },
  {
    n: '03',
    title: 'Verify',
    body: 'Automated restore drills restore to a scratch location and diff against the source, so you know it works before you need it.',
  },
];

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

      {/* Hero — centered, dot-grid backdrop, answer-first block (AEO) below */}
      <section className="pattern-dot-grid [background-position:center_top]">
        <Container wide className="flex flex-col items-center pb-16 pt-20 text-center sm:pt-28">
          <Eyebrow>Docker-aware backup &amp; restore</Eyebrow>
          <h1 className={cn(h1Class, 'max-w-[18ch]')}>
            Back Up Your <Serif>Entire</Serif>
            <br />
            Docker Project
          </h1>
          <p className="max-w-[560px] text-balance text-lg text-muted-foreground">
            One click detects your volumes, databases, and config — and proves
            the backup restores. No backup config required.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/register">
                Start free
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to={href('/guides/backup-postgres-docker')}>
                See how it works
              </Link>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <CheckItem>Consistent database dumps</CheckItem>
            <CheckItem>Encrypted Restic snapshots</CheckItem>
            <CheckItem>Verified restore drills</CheckItem>
          </div>
          <div
            className="mt-10 flex flex-wrap items-center justify-center gap-2"
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
        </Container>
      </section>

      {/* Answer-first extract (AEO target) */}
      <section className="pb-4">
        <Container className="max-w-3xl">
          <p className="rounded-xl border bg-muted/50 p-6 text-center text-lg leading-relaxed">
            {ANSWER}
          </p>
        </Container>
      </section>

      {/* Amplify — pain */}
      <Reveal as="section" className={sectionClass}>
        <Container>
          <div className="mb-10 text-center">
            <h2 className={h2Class}>
              Most homemade Docker backups are <Serif>broken</Serif>
            </h2>
            <p className="mx-auto max-w-[560px] text-muted-foreground">
              The failure is invisible until the day you need the restore.
            </p>
          </div>
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
                <h3 className="text-base font-semibold tracking-tight">{card.h}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{card.p}</p>
              </Reveal>
            ))}
          </div>
        </Container>
      </Reveal>

      {/* Features — sticky heading beside a flat icon-tile grid */}
      <Reveal as="section" className={sectionClass}>
        <Container wide>
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <h2 className={h2Class}>
                Powerful Tools
                <br />
                For <Serif>Total Confidence</Serif>
              </h2>
              <p className="max-w-[420px] text-muted-foreground">
                Everything you need to back up a Docker project correctly, keep
                the data on storage you control, and know the restore works.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} index={i}>
                  <FeatureCard icon={f.icon} title={f.title}>
                    {f.body}
                  </FeatureCard>
                </Reveal>
              ))}
            </div>
          </div>
        </Container>
      </Reveal>

      {/* Showcase — what a run actually does */}
      <Reveal as="section" className={sectionClass}>
        <Container wide>
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className={h2Class}>
                Verified Snapshots in <Serif>Seconds</Serif>
              </h2>
              <p className="max-w-[460px] text-muted-foreground">
                Dockstash reads your Compose stack, runs the correct consistent
                dump for each engine, stores an encrypted off-site Restic
                snapshot — then proves it restores with an automated drill.
              </p>
              <p className="mt-5">
                <Link
                  to={href('/alternatives/backrest')}
                  className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
                >
                  Compared to Backrest and DIY scripts
                  <ArrowRightIcon aria-hidden="true" className="size-4" />
                </Link>
              </p>
            </div>
            <code className={cn(codeClass, 'shadow-xs')}>{SHOWCASE}</code>
          </div>
        </Container>
      </Reveal>

      {/* Three steps */}
      <Reveal as="section" className={sectionClass}>
        <Container wide>
          <div className="mb-12 text-center">
            <h2 className={h2Class}>
              Three Steps to <Serif>Confidence</Serif>
            </h2>
            <p className="mx-auto max-w-[520px] text-muted-foreground">
              We’ve simplified backups so you can focus on shipping your app.
            </p>
          </div>
          <ol className="grid list-none gap-10 p-0 sm:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n}>
                <span
                  aria-hidden="true"
                  className="font-serif text-5xl italic text-muted-foreground/40"
                >
                  {step.n}
                </span>
                <span className="mb-3 mt-2 block h-px w-10 bg-border" aria-hidden="true" />
                <h3 className="mb-2 text-lg font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </Container>
      </Reveal>

      <FaqSection faqs={HOME_FAQ} />

      {/* Closing CTA — inverted band */}
      <InvertedBand className="pattern-dot-grid text-center">
        <Container className="max-w-2xl">
          <h2 className={h2Class}>
            Ready to Trust Your <Serif>Backups?</Serif>
          </h2>
          <p className="mx-auto max-w-prose text-lg text-muted-foreground">
            Back up your first Docker project in minutes. Free and fully
            self-hosted to start — no card, your storage, your keys.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/register">
                Start free
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to={href('/pricing')}>See pricing</Link>
            </Button>
          </div>
        </Container>
      </InvertedBand>
    </>
  );
};
