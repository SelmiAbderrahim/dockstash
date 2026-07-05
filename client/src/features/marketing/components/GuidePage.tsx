import { Link, useParams } from 'react-router-dom';
import { Seo, SsrNotFound, schema } from '@shared/seo';
import { Button } from '@shared/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@shared/ui/table';
import {
  getServiceGuide,
  getUseCase,
  guideIntro,
  consistencyNote,
} from '@features/marketing/content';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import {
  Breadcrumbs,
  CodeBlock,
  Container,
  Eyebrow,
  FaqSection,
  LastUpdated,
  LinkCard,
  answerClass,
  h1Class,
  h2Class,
  sectionClass,
} from './shared';
import { Reveal } from '../useReveal';

const listClass = 'list-disc space-y-1.5 ps-5 text-muted-foreground';

export const GuidePage = () => {
  const { entry } = useParams();
  const { locale } = useMarketingRoute();
  const href = (path: string) => localeHref(path, locale);
  /* v8 ignore next 4 -- `entry` is route-guaranteed; the empty/undefined arms are unreachable */
  const slug = (entry ?? '')
    .replace(/^backup-/, '')
    .replace(/-docker$/, '');
  const guide = slug ? getServiceGuide(slug) : undefined;

  if (!guide) {
    return (
      <>
        <Seo
          title="Guide not found"
          description="This Docker backup guide could not be found. Browse all database and app backup guides from the guides hub."
          basePath="/guides"
          locale={locale}
          noindex
        />
        <SsrNotFound />
        <section className={sectionClass}>
          <Container>
            <h1 className={h1Class}>Guide not found</h1>
            <p className="text-muted-foreground">
              We could not find that guide.{' '}
              <Link
                to={href('/guides')}
                className="text-primary underline-offset-4 hover:underline"
              >
                See all Docker backup guides
              </Link>
              .
            </p>
          </Container>
        </section>
      </>
    );
  }

  const basePath = `/guides/backup-${guide.slug}-docker`;

  const howToSteps = [
    {
      name: 'Scan the Docker project',
      text: `Dockstash scans the Compose project and detects the ${guide.serviceName} container from images like ${guide.dockerImages[0]} and env keys such as ${guide.envKeysDetected.slice(0, 2).join(', ')}.`,
    },
    {
      name: `Dump ${guide.serviceName} from the running container`,
      text: `Run ${guide.dumpCmd} inside the container. ${consistencyNote(guide)}`,
    },
    {
      name: 'Store an encrypted Restic snapshot off-site',
      text: `Hand the dump to restic, which encrypts, deduplicates, and stores it on your storage VPS over SSH — never copying ${guide.liveDataPaths[0]} live.`,
    },
    {
      name: 'Verify with a restore drill',
      text: `Restore the latest snapshot to a scratch location with ${guide.restoreCmd} and diff it against the source so you know the backup restores.`,
    },
  ];

  const lastModified = schema.monthToIso(guide.lastReviewed);

  const jsonLd = schema.graph(
    ...schema.siteEntities(),
    schema.article({
      headline: `How to back up a ${guide.serviceName} Docker container`,
      description: `The correct, consistent way to back up ${guide.serviceName} in Docker — dump from the running container, encrypted off-site Restic snapshots, and a verified restore.`,
      path: localeHref(basePath, locale),
      dateModified: lastModified,
      inLanguage: locale,
    }),
    schema.howTo(
      `How to back up a ${guide.serviceName} Docker container`,
      howToSteps,
    ),
    schema.breadcrumbList([
      { name: 'Home', path: localeHref('/', locale) },
      { name: 'Guides', path: localeHref('/guides', locale) },
      { name: guide.serviceName, path: localeHref(basePath, locale) },
    ]),
    schema.faqPage(guide.faq),
  );

  return (
    <>
      <Seo
        title={`Back up a ${guide.serviceName} Docker container (2026)`}
        description={`How to back up ${guide.serviceName} in Docker: a consistent dump from the running container, encrypted off-site Restic snapshots, and a verified restore.`}
        basePath={basePath}
        locale={locale}
        localized={false}
        type="article"
        dateModified={lastModified}
        jsonLd={jsonLd}
      />

      <Container>
        <Breadcrumbs
          crumbs={[
            { label: 'Home', basePath: '/' },
            { label: 'Guides', basePath: '/guides' },
            { label: guide.serviceName },
          ]}
          locale={locale}
        />
      </Container>

      <section className={sectionClass}>
        <Container>
          <h1 className={h1Class}>
            How to back up a {guide.serviceName} Docker container (2026)
          </h1>
          <p className={answerClass}>
            {guideIntro(guide)}
          </p>
        </Container>
      </section>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <Eyebrow>Detection</Eyebrow>
          <h2 className={h2Class}>What Dockstash detects</h2>
          <Table className="border">
            <TableBody>
              <TableRow>
                <TableHead
                  scope="row"
                  className="w-1/3 whitespace-normal text-start align-top font-medium"
                >
                  Env keys detected
                </TableHead>
                <TableCell className="whitespace-normal align-top">
                  {guide.envKeysDetected.join(', ')}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableHead
                  scope="row"
                  className="w-1/3 whitespace-normal text-start align-top font-medium"
                >
                  Default port
                </TableHead>
                <TableCell className="whitespace-normal align-top">
                  {guide.defaultPort || '—'}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableHead
                  scope="row"
                  className="w-1/3 whitespace-normal text-start align-top font-medium"
                >
                  Live data paths (never copied live)
                </TableHead>
                <TableCell className="whitespace-normal align-top">
                  {guide.liveDataPaths.join(', ')}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableHead
                  scope="row"
                  className="w-1/3 whitespace-normal text-start align-top font-medium"
                >
                  Example images
                </TableHead>
                <TableCell className="whitespace-normal align-top">
                  {guide.dockerImages.join(', ')}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Container>
      </Reveal>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <Eyebrow>Commands</Eyebrow>
          <h2 className={h2Class}>The dump command</h2>
          <CodeBlock>{guide.dumpCmd}</CodeBlock>
          <h2 className={`${h2Class} mt-8`}>The restore command</h2>
          <CodeBlock>{guide.restoreCmd}</CodeBlock>
          <p className="mt-4 text-muted-foreground">{consistencyNote(guide)}</p>
        </Container>
      </Reveal>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <Eyebrow>The gotchas</Eyebrow>
          <h2 className={h2Class}>Gotchas to avoid</h2>
          <ul className={listClass}>
            {guide.gotchas.map((gotcha) => (
              <li key={gotcha}>{gotcha}</li>
            ))}
          </ul>
        </Container>
      </Reveal>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <h2 className={h2Class}>Do it in one click with Dockstash</h2>
          <p className="max-w-prose text-muted-foreground">
            Dockstash runs the exact dump above, restics it off-site, and
            drill-tests the restore automatically — no script to maintain.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/register">Start free</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={href('/guides')}>All guides</Link>
            </Button>
          </div>
          <LastUpdated iso={guide.lastReviewed} />
        </Container>
      </Reveal>

      {/* v8 ignore next 2 -- shipped guides always carry related content; the false arm is unreachable */}
      {(guide.relatedServices.length > 0 ||
        guide.relatedUseCases.length > 0) && (
        <Reveal as="section" className={sectionClass}>
          <Container>
            <h2 className={h2Class}>Related</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {guide.relatedServices.map((related) => {
                const relatedGuide = getServiceGuide(related);
                /* v8 ignore next -- every shipped relatedService slug resolves */
                if (!relatedGuide) return null;
                return (
                  <LinkCard
                    key={`svc-${related}`}
                    to={href(`/guides/backup-${related}-docker`)}
                    title={relatedGuide.serviceName}
                    description={`Back up ${relatedGuide.serviceName} in Docker`}
                  />
                );
              })}
              {guide.relatedUseCases.map((related) => {
                const relatedApp = getUseCase(related);
                /* v8 ignore next -- every shipped relatedUseCase slug resolves */
                if (!relatedApp) return null;
                return (
                  <LinkCard
                    key={`app-${related}`}
                    to={href(`/backup/${related}-docker`)}
                    title={relatedApp.appName}
                    description={relatedApp.category}
                  />
                );
              })}
            </div>
          </Container>
        </Reveal>
      )}

      <FaqSection faqs={guide.faq} />
    </>
  );
};
