import { Link } from 'react-router-dom';
import { Seo, schema } from '@shared/seo';
import { COMPETITORS } from '@features/marketing/content';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import { Reveal } from '../useReveal';
import {
  Breadcrumbs,
  Container,
  Eyebrow,
  FaqSection,
  LinkCard,
  ResponsiveTable,
  answerClass,
  h1Class,
  h2Class,
  sectionClass,
} from './shared';
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
        localized={false}
        jsonLd={jsonLd}
      />

      <Container>
        <Breadcrumbs
          crumbs={[{ label: 'Home', basePath: '/' }, { label: 'Alternatives' }]}
          locale={locale}
        />
      </Container>

      <section className={sectionClass}>
        <Container>
          <Eyebrow>Compare</Eyebrow>
          <h1 className={h1Class}>Dockstash alternatives</h1>
          <p className={answerClass}>{ANSWER}</p>
        </Container>
      </section>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <Eyebrow>Comparison</Eyebrow>
          <h2 className={h2Class}>At a glance</h2>
          <ResponsiveTable
            columns={[
              { key: 'tool', label: 'Tool' },
              { key: 'category', label: 'Category' },
              { key: 'pricing', label: 'Pricing' },
              { key: 'docker-aware', label: 'Docker-aware' },
            ]}
            rows={COMPETITOR_LIST.map((competitor) => ({
              key: competitor.slug,
              header: (
                <Link
                  to={href(`/alternatives/${competitor.slug}`)}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {competitor.name}
                </Link>
              ),
              cells: [
                competitor.category,
                competitor.pricing,
                'No — Dockstash is',
              ],
            }))}
          />
        </Container>
      </Reveal>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <h2 className={h2Class}>Compare each alternative</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ...COMPETITOR_LIST.map((competitor) => ({
                to: href(`/alternatives/${competitor.slug}`),
                title: competitor.name,
                description: competitor.category,
              })),
              {
                to: href('/vs/backrest'),
                title: 'Dockstash vs Backrest',
                description: 'Head-to-head comparison',
              },
              {
                to: href('/compare/self-hosted-backup-vs-cloud-backup'),
                title: 'Self-hosted vs cloud backup',
                description: 'Category comparison',
              },
            ].map((card, i) => (
              <Reveal key={card.to} index={i}>
                <LinkCard
                  to={card.to}
                  title={card.title}
                  description={card.description}
                />
              </Reveal>
            ))}
          </div>
        </Container>
      </Reveal>

      <FaqSection faqs={HUB_FAQ} />
    </>
  );
};
