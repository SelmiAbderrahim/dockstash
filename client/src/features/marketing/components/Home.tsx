import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  BellRingIcon,
  CheckIcon,
  DatabaseIcon,
  HardDriveIcon,
  LockIcon,
  ScanSearchIcon,
  ShieldCheckIcon,
} from 'lucide-react';
import { Seo, schema } from '@shared/seo';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { localeHref } from '../useMarketingRoute';
import { SERVICE_GUIDES } from '../content';
import { Reveal } from '../useReveal';
import {
  CheckItem,
  Container,
  Eyebrow,
  FaqSection,
  FeatureCard,
  InvertedBand,
  ResponsiveTable,
  Serif,
  TerminalFrame,
  answerClass,
  cardClass,
  h1Class,
  h2Class,
  sectionClass,
  useMarketingT,
} from './shared';
import { cn } from '@shared/lib/utils';
import type { FaqItem } from '../types';

// FAQ entries live in the marketing namespace (home.faq.*); one built array
// feeds both the visible FaqSection and the JSON-LD FAQPage schema.
const HOME_FAQ_KEYS = ['dbBackup', 'storage', 'restoreProof', 'config'] as const;

// Real, accurate snippet — shows what Dockstash detects and the consistent dump
// it runs for you (no live data-directory copy). Not a mockup: this is the
// actual pg_dumpall path used by the Postgres adapter. Code stays untranslated.
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

// Icons and copy keys for the feature grid; the visible copy lives in the
// marketing namespace (home.features.cards.*).
const FEATURE_DEFS = [
  { icon: <ScanSearchIcon />, key: 'detection' },
  { icon: <DatabaseIcon />, key: 'dumps' },
  { icon: <ShieldCheckIcon />, key: 'drills' },
  { icon: <HardDriveIcon />, key: 'storage' },
  { icon: <LockIcon />, key: 'encryption' },
  { icon: <BellRingIcon />, key: 'alerts' },
] as const;

// Honest product-shaped stats (no fabricated customer counts): supported
// engines come straight from the guide dataset; the rest restate real
// product facts already claimed elsewhere on this page.
const STAT_DEFS = [
  { value: String(SUPPORTED.length), key: 'engines' },
  { value: 'AES-256', key: 'encryption' },
  { value: '100%', key: 'restic' },
  { value: '1', key: 'oneClick' },
] as const;

// Illustrative drill-report rows for the product-proof panel. Shapes match
// the real per-project drill status Dockstash surfaces.
const DRILL_ROWS = [
  { project: 'wordpress-prod', snapshot: '4f9a2c1d' },
  { project: 'api-postgres', snapshot: 'b81e07aa' },
  { project: 'metrics-influx', snapshot: 'c3d54e92' },
];

/** Flat product-proof panel: per-project restore-drill status rows. */
const DrillReportCard = () => {
  const { t } = useMarketingT();
  return (
    <div className="divide-y rounded-xl border bg-card shadow-xs">
      {DRILL_ROWS.map((row) => (
        <div key={row.project} className="flex items-center justify-between gap-4 p-4">
          <span className="font-mono text-sm">{row.project}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {row.snapshot}
          </span>
          <Badge variant="outline">
            <CheckIcon aria-hidden="true" className="size-3" />
            {t('home.showcase.drillPassed')}
          </Badge>
        </div>
      ))}
    </div>
  );
};

const STEP_DEFS = [
  { n: '01', key: 'scan' },
  { n: '02', key: 'backUp' },
  { n: '03', key: 'verify' },
] as const;

const PAIN_CARD_KEYS = ['liveFiles', 'silent', 'fragile'] as const;

const COMPARE_ROW_KEYS = ['dumps', 'drills', 'compose'] as const;

export const Home = () => {
  const { t, locale } = useMarketingT();
  const href = (path: string) => localeHref(path, locale);

  const homeFaq: FaqItem[] = HOME_FAQ_KEYS.map((key) => ({
    question: t(`home.faq.${key}.question`),
    answer: t(`home.faq.${key}.answer`),
  }));

  const jsonLd = schema.graph(
    ...schema.siteEntities(),
    schema.softwareApplication([{ name: 'Free', price: '0' }]),
    schema.faqPage(homeFaq),
  );

  return (
    <>
      <Seo
        title={t('home.seo.title')}
        description={t('home.seo.description')}
        basePath="/"
        locale={locale}
        jsonLd={jsonLd}
      />

      {/* Hero — two-column at lg, dot-grid backdrop, answer-first block (AEO) below */}
      <section className="pattern-dot-grid [background-position:center_top]">
        <Container
          wide
          className="grid items-center gap-12 pb-16 pt-16 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16"
        >
          <div className="text-center lg:text-start">
            <Eyebrow>{t('home.hero.eyebrow')}</Eyebrow>
            <h1 className={cn(h1Class, 'mx-auto max-w-[18ch] lg:mx-0')}>
              {t('home.hero.title.pre')} <Serif>{t('home.hero.title.accent')}</Serif>
              <br />
              {t('home.hero.title.post')}
            </h1>
            <p className="mx-auto max-w-[560px] text-balance text-base text-muted-foreground sm:text-lg lg:mx-0">
              {t('home.hero.sub')}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Button asChild size="lg">
                <Link to="/register">
                  {t('shared.startFree')}
                  <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to={href('/guides/backup-postgres-docker')}>
                  {t('home.hero.secondaryCta')}
                </Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
              <CheckItem>{t('home.hero.check.dumps')}</CheckItem>
              <CheckItem>{t('home.hero.check.snapshots')}</CheckItem>
              <CheckItem>{t('home.hero.check.drills')}</CheckItem>
            </div>
          </div>
          <TerminalFrame title="dockstash — backup run">
            <pre className="overflow-x-auto whitespace-pre p-4 font-mono text-xs leading-relaxed [tab-size:2]">
              {SHOWCASE}
            </pre>
          </TerminalFrame>
        </Container>
        <Container wide className="pb-16">
          <div
            className="flex flex-wrap items-center justify-center gap-2"
            aria-label={t('home.hero.supportedLabel')}
          >
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {t('home.hero.backsUp')}
            </span>
            {SUPPORTED.map((name) => (
              <Badge key={name} variant="outline" className="font-mono text-xs">
                {name}
              </Badge>
            ))}
          </div>
        </Container>
      </section>

      {/* Answer-first extract (AEO target) */}
      <section className="pb-4">
        <Container className="max-w-3xl">
          <p className={cn(answerClass, 'mx-auto rounded-xl p-6 text-center')}>
            {t('home.answer')}
          </p>
        </Container>
      </section>

      {/* Amplify — pain */}
      <Reveal as="section" className={sectionClass}>
        <Container>
          <div className="mb-10 text-center">
            <h2 className={h2Class}>
              {t('home.pain.title.pre')} <Serif>{t('home.pain.title.accent')}</Serif>
            </h2>
            <p className="mx-auto max-w-[560px] text-muted-foreground">
              {t('home.pain.sub')}
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PAIN_CARD_KEYS.map((key, i) => (
              <Reveal key={key} className={cn(cardClass, 'space-y-2')} index={i}>
                <h3 className="text-base font-semibold tracking-tight">
                  {t(`home.pain.cards.${key}.title`)}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(`home.pain.cards.${key}.body`)}
                </p>
              </Reveal>
            ))}
          </div>
        </Container>
      </Reveal>

      {/* Stat strip — serif numerals, product-fact stats */}
      <Reveal as="section" className={sectionClass}>
        <Container>
          <dl className="grid grid-cols-2 gap-y-10 lg:grid-cols-4">
            {STAT_DEFS.map((stat, i) => (
              <Reveal key={stat.key} className="text-center" index={i}>
                <dd className="font-serif text-4xl italic sm:text-5xl">
                  {stat.value}
                </dd>
                <dt className="mt-2 text-sm text-muted-foreground">
                  {t(`home.stats.${stat.key}`)}
                </dt>
              </Reveal>
            ))}
          </dl>
        </Container>
      </Reveal>

      {/* Features — sticky heading beside a flat icon-tile grid */}
      <Reveal as="section" className={sectionClass}>
        <Container wide>
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <h2 className={h2Class}>
                {t('home.features.title.pre')}
                <br />
                {t('home.features.title.mid')} <Serif>{t('home.features.title.accent')}</Serif>
              </h2>
              <p className="max-w-[420px] text-muted-foreground">
                {t('home.features.sub')}
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {FEATURE_DEFS.map((f, i) => (
                <Reveal key={f.key} index={i}>
                  <FeatureCard icon={f.icon} title={t(`home.features.cards.${f.key}.title`)}>
                    {t(`home.features.cards.${f.key}.body`)}
                  </FeatureCard>
                </Reveal>
              ))}
            </div>
          </div>
        </Container>
      </Reveal>

      {/* Showcase — product proof: per-project drill report */}
      <Reveal as="section" className={sectionClass}>
        <Container wide>
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className={h2Class}>
                {t('home.showcase.title.pre')} <Serif>{t('home.showcase.title.accent')}</Serif>
              </h2>
              <p className="max-w-[460px] text-muted-foreground">
                {t('home.showcase.body')}
              </p>
              <p className="mt-5">
                <Link
                  to={href('/alternatives/backrest')}
                  className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
                >
                  {t('home.showcase.compareLink')}
                  <ArrowRightIcon aria-hidden="true" className="size-4" />
                </Link>
              </p>
            </div>
            <DrillReportCard />
          </div>
        </Container>
      </Reveal>

      {/* Three steps */}
      <Reveal as="section" className={sectionClass}>
        <Container wide>
          <div className="mb-12 text-center">
            <h2 className={h2Class}>
              {t('home.steps.title.pre')} <Serif>{t('home.steps.title.accent')}</Serif>
            </h2>
            <p className="mx-auto max-w-[520px] text-muted-foreground">
              {t('home.steps.sub')}
            </p>
          </div>
          <ol className="grid list-none gap-10 p-0 sm:relative sm:grid-cols-3">
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-6 hidden h-px bg-border sm:block"
            />
            {STEP_DEFS.map((step, i) => (
              <Reveal as="li" key={step.n} index={i}>
                <span
                  aria-hidden="true"
                  className="relative inline-block bg-background pe-4 font-serif text-5xl italic text-muted-foreground/40"
                >
                  {step.n}
                </span>
                <span className="mb-3 mt-2 block h-px w-10 bg-border" aria-hidden="true" />
                <h3 className="mb-2 text-lg font-semibold tracking-tight">
                  {t(`home.steps.items.${step.key}.title`)}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(`home.steps.items.${step.key}.body`)}
                </p>
              </Reveal>
            ))}
          </ol>
        </Container>
      </Reveal>

      {/* Comparison teaser — Docker-aware vs generic file copies */}
      <Reveal as="section" className={sectionClass}>
        <Container>
          <div className="mb-10 text-center">
            <Eyebrow>{t('home.compare.eyebrow')}</Eyebrow>
            <h2 className={h2Class}>
              {t('home.compare.title.pre')} <Serif>{t('home.compare.title.accent')}</Serif>
            </h2>
          </div>
          <ResponsiveTable
            columns={[
              { key: 'capability', label: t('shared.capability') },
              { key: 'dockstash', label: 'Dockstash' },
              { key: 'backrest', label: 'Backrest' },
              { key: 'diy', label: t('home.compare.diyColumn') },
            ]}
            rows={COMPARE_ROW_KEYS.map((key) => ({
              key,
              header: t(`home.compare.rows.${key}.header`),
              cells: [
                t(`home.compare.rows.${key}.dockstash`),
                t(`home.compare.rows.${key}.backrest`),
                t(`home.compare.rows.${key}.diy`),
              ],
            }))}
          />
          <div className="mt-6 text-center">
            <Button asChild variant="outline">
              <Link to={href('/alternatives')}>
                {t('home.compare.cta')}
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </Container>
      </Reveal>

      <FaqSection faqs={homeFaq} />

      {/* Closing CTA — inverted band */}
      <InvertedBand className="pattern-dot-grid text-center">
        <Container className="max-w-2xl">
          <h2 className={h2Class}>
            {t('home.cta.title.pre')} <Serif>{t('home.cta.title.accent')}</Serif>
          </h2>
          <p className="mx-auto max-w-prose text-base text-muted-foreground sm:text-lg">
            {t('home.cta.body')}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/register">
                {t('shared.startFree')}
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to={href('/pricing')}>{t('home.cta.seePricing')}</Link>
            </Button>
          </div>
        </Container>
      </InvertedBand>
    </>
  );
};
