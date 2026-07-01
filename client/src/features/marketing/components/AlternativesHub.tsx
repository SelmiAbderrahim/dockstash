import { Link } from 'react-router-dom';
import { Seo, schema } from '@shared/seo';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/ui/table';
import { COMPETITORS } from '@features/marketing/content';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import { Reveal } from '../useReveal';
import {
  Breadcrumbs,
  Container,
  Eyebrow,
  FaqSection,
  LinkCard,
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
          <h1 className={h1Class}>Dockstash alternatives</h1>
          <p className="max-w-[720px] rounded-lg border border-border bg-muted p-5 text-lg leading-relaxed">
            {ANSWER}
          </p>
        </Container>
      </section>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <Eyebrow>Comparison</Eyebrow>
          <h2 className={h2Class}>At a glance</h2>
          <Table className="border">
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="text-start align-top">Tool</TableHead>
                <TableHead scope="col" className="text-start align-top">Category</TableHead>
                <TableHead scope="col" className="text-start align-top">Pricing</TableHead>
                <TableHead scope="col" className="text-start align-top">
                  Docker-aware
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {COMPETITOR_LIST.map((competitor) => (
                <TableRow key={competitor.slug}>
                  <TableHead
                    scope="row"
                    className="whitespace-normal text-start align-top font-medium"
                  >
                    <Link
                      to={href(`/alternatives/${competitor.slug}`)}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {competitor.name}
                    </Link>
                  </TableHead>
                  <TableCell className="whitespace-normal align-top">
                    {competitor.category}
                  </TableCell>
                  <TableCell className="whitespace-normal align-top">
                    {competitor.pricing}
                  </TableCell>
                  <TableCell className="whitespace-normal align-top">
                    No — Dockstash is
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Container>
      </Reveal>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <h2 className={h2Class}>Compare each alternative</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {COMPETITOR_LIST.map((competitor) => (
              <LinkCard
                key={competitor.slug}
                to={href(`/alternatives/${competitor.slug}`)}
                title={competitor.name}
                description={competitor.category}
              />
            ))}
            <LinkCard
              to={href('/vs/backrest')}
              title="Dockstash vs Backrest"
              description="Head-to-head comparison"
            />
            <LinkCard
              to={href('/compare/self-hosted-backup-vs-cloud-backup')}
              title="Self-hosted vs cloud backup"
              description="Category comparison"
            />
          </div>
        </Container>
      </Reveal>

      <FaqSection faqs={HUB_FAQ} />
    </>
  );
};
