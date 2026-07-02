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
  getUseCase,
  getServiceGuide,
  // Aliased to a non-`use*` name: it's a plain string builder, not a React
  // hook, and the `use` prefix trips react-hooks/rules-of-hooks after the
  // early return below.
  useCaseIntro as buildUseCaseIntro,
} from '@features/marketing/content';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import {
  Breadcrumbs,
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

export const UseCasePage = () => {
  const { entry } = useParams();
  const { locale } = useMarketingRoute();
  const href = (path: string) => localeHref(path, locale);
  /* v8 ignore next 2 -- `entry` is route-guaranteed; the empty/undefined arms are unreachable */
  const slug = (entry ?? '').replace(/-docker$/, '');
  const app = slug ? getUseCase(slug) : undefined;

  if (!app || app.backupPlan.length === 0) {
    return (
      <>
        <Seo
          title="Backup guide not found"
          description="This app backup guide could not be found. Browse all database and app backup guides from the guides hub."
          basePath="/guides"
          locale={locale}
          noindex
        />
        <SsrNotFound />
        <section className={sectionClass}>
          <Container>
            <h1 className={h1Class}>Backup guide not found</h1>
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

  const basePath = `/backup/${app.slug}-docker`;

  const lastModified = schema.monthToIso(app.lastReviewed);

  const jsonLd = schema.graph(
    schema.article({
      headline: `How to back up ${app.appName} in Docker`,
      description: `Back up ${app.appName} in Docker completely — its database, data volumes, and config — stored encrypted off-site with a verified restore.`,
      path: localeHref(basePath, locale),
      dateModified: lastModified,
      inLanguage: locale,
    }),
    schema.howTo(
      `How to back up ${app.appName} in Docker`,
      app.backupPlan.map((step) => ({
        name: step.title,
        text: step.detail,
      })),
    ),
    schema.breadcrumbList([
      { name: 'Home', path: localeHref('/', locale) },
      { name: 'Guides', path: localeHref('/guides', locale) },
      { name: app.appName, path: localeHref(basePath, locale) },
    ]),
    schema.faqPage(app.faq),
  );

  return (
    <>
      <Seo
        title={`How to back up ${app.appName} in Docker (2026)`}
        description={`Back up ${app.appName} in Docker completely: database dump, data volumes, and config — stored encrypted off-site with a verified restore.`}
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
            { label: app.appName },
          ]}
          locale={locale}
        />
      </Container>

      <section className={sectionClass}>
        <Container>
          <h1 className={h1Class}>
            How to back up {app.appName} in Docker (2026)
          </h1>
          <p className={answerClass}>
            {buildUseCaseIntro(app)}
          </p>
        </Container>
      </section>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <Eyebrow>What it stores</Eyebrow>
          <h2 className={h2Class}>What {app.appName} stores</h2>
          <Table className="border">
            <TableBody>
              <TableRow>
                <TableHead
                  scope="row"
                  className="w-1/3 whitespace-normal text-start align-top font-medium"
                >
                  Compose services
                </TableHead>
                <TableCell className="whitespace-normal align-top">
                  {app.composeServices.join(', ')}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableHead
                  scope="row"
                  className="w-1/3 whitespace-normal text-start align-top font-medium"
                >
                  Databases detected
                </TableHead>
                <TableCell className="whitespace-normal align-top">
                  {app.detectedDbs.join(', ')}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableHead
                  scope="row"
                  className="w-1/3 whitespace-normal text-start align-top font-medium"
                >
                  Data volumes
                </TableHead>
                <TableCell className="whitespace-normal align-top">
                  {app.detectedVolumes.join(', ')}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableHead
                  scope="row"
                  className="w-1/3 whitespace-normal text-start align-top font-medium"
                >
                  Config paths
                </TableHead>
                <TableCell className="whitespace-normal align-top">
                  {app.configPaths.join(', ')}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Container>
      </Reveal>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <Eyebrow>Step by step</Eyebrow>
          <h2 className={h2Class}>The backup plan</h2>
          <ol className="list-decimal space-y-3 ps-5 marker:font-semibold marker:text-primary">
            {app.backupPlan.map((step) => (
              <li key={step.title}>
                <strong className="font-semibold text-foreground">
                  {step.title}.
                </strong>{' '}
                {step.detail}
              </li>
            ))}
          </ol>
        </Container>
      </Reveal>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <h2 className={h2Class}>Restoring {app.appName}</h2>
          <p className="max-w-prose">{app.restoreNotes}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/register">Back up {app.appName} in one click</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={href('/guides')}>All guides</Link>
            </Button>
          </div>
          <LastUpdated iso={app.lastReviewed} />
        </Container>
      </Reveal>

      {app.relatedGuides.length > 0 && (
        <Reveal as="section" className={sectionClass}>
          <Container>
            <h2 className={h2Class}>Related database guides</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {app.relatedGuides.map((related) => {
                const relatedGuide = getServiceGuide(related);
                /* v8 ignore next -- every shipped relatedGuide slug resolves */
                if (!relatedGuide) return null;
                return (
                  <LinkCard
                    key={related}
                    to={href(`/guides/backup-${related}-docker`)}
                    title={relatedGuide.serviceName}
                    description={`Back up ${relatedGuide.serviceName} in Docker`}
                  />
                );
              })}
            </div>
          </Container>
        </Reveal>
      )}

      <FaqSection faqs={app.faq} />
    </>
  );
};
