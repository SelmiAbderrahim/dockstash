import { Link } from 'react-router-dom';
import { Seo, schema } from '@shared/seo';
import { Button } from '@shared/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@shared/ui/card';
import { getCompetitor } from '@features/marketing/content';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import {
  Breadcrumbs,
  Container,
  Eyebrow,
  FaqSection,
  ResponsiveTable,
  answerClass,
  h1Class,
  h2Class,
  sectionClass,
} from './shared';
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
    ...schema.siteEntities(),
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
        localized={false}
        jsonLd={jsonLd}
      />

      <Container>
        <Breadcrumbs
          crumbs={[
            { label: 'Home', basePath: '/' },
            { label: 'Alternatives', basePath: '/alternatives' },
            { label: 'Self-hosted vs cloud' },
          ]}
          locale={locale}
        />
      </Container>

      <section className={sectionClass}>
        <Container>
          <h1 className={h1Class}>Self-hosted backup vs cloud backup</h1>
          <p className={answerClass}>{ANSWER}</p>
        </Container>
      </section>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <Eyebrow>Head to head</Eyebrow>
          <h2 className={h2Class}>Side by side</h2>
          <ResponsiveTable
            columns={[
              { key: 'dimension', label: 'Dimension' },
              { key: 'self-hosted', label: 'Self-hosted (Dockstash)' },
              { key: 'cloud', label: 'Cloud backup SaaS' },
            ]}
            rows={ROWS.map((row) => ({
              key: row.feature,
              header: row.feature,
              cells: [row.dockstash, row.competitor],
            }))}
          />
        </Container>
      </Reveal>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <h2 className={h2Class}>When to pick each</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg tracking-tight">
                  Pick self-hosted backup
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  You want backups that stay entirely on your own infrastructure,
                  with no recurring per-source fee and no third party in the data
                  path — and you run your workloads in Docker.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg tracking-tight">
                  Pick cloud backup SaaS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {/* v8 ignore next 3 -- every comparison category resolves a cloud competitor */}
                  {cloud
                    ? cloud.bestFor
                    : 'You want a hands-off managed service and are happy to pay a subscription and route backups through a third-party platform.'}
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/register">Start free, self-hosted</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={href('/alternatives/simplebackups')}>
                Dockstash vs a cloud backup SaaS
              </Link>
            </Button>
          </div>
        </Container>
      </Reveal>

      <FaqSection faqs={FAQ} />
    </>
  );
};
