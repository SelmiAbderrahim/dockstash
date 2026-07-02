import { Link, useParams } from 'react-router-dom';
import { Seo, SsrNotFound, schema } from '@shared/seo';
import { Button } from '@shared/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@shared/ui/card';
import { getCompetitor } from '@features/marketing/content';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import { Reveal } from '../useReveal';
import {
  Breadcrumbs,
  ComparisonTable,
  Container,
  Eyebrow,
  FaqSection,
  LastUpdated,
  answerClass,
  h1Class,
  h2Class,
  sectionClass,
} from './shared';

export const VsPage = () => {
  const { slug } = useParams();
  const { locale } = useMarketingRoute();
  const href = (path: string) => localeHref(path, locale);
  /* v8 ignore next -- `slug` is guaranteed by the :slug route param; the undefined arm is unreachable */
  const competitor = slug ? getCompetitor(slug) : undefined;

  if (!competitor) {
    return (
      <>
        <Seo
          title="Comparison not found"
          description="This head-to-head comparison could not be found. Browse all Docker backup alternatives from the alternatives hub."
          basePath="/alternatives"
          locale={locale}
          noindex
        />
        <SsrNotFound />
        <section className={sectionClass}>
          <Container>
            <h1 className={h1Class}>Comparison not found</h1>
            <p className="text-muted-foreground">
              We could not find that comparison.{' '}
              <Link
                to={href('/alternatives')}
                className="text-primary underline-offset-4 hover:underline"
              >
                See all Dockstash alternatives
              </Link>
              .
            </p>
          </Container>
        </section>
      </>
    );
  }

  const basePath = `/vs/${competitor.slug}`;

  const jsonLd = schema.graph(
    schema.webPage(
      `Dockstash vs ${competitor.name}`,
      `Head-to-head comparison of Dockstash and ${competitor.name} for Docker backups.`,
      localeHref(basePath, locale),
    ),
    schema.breadcrumbList([
      { name: 'Home', path: localeHref('/', locale) },
      { name: 'Alternatives', path: localeHref('/alternatives', locale) },
      {
        name: `Dockstash vs ${competitor.name}`,
        path: localeHref(basePath, locale),
      },
    ]),
    schema.faqPage(competitor.faq),
  );

  return (
    <>
      <Seo
        title={`Dockstash vs ${competitor.name} (2026)`}
        description={`Dockstash vs ${competitor.name}, head-to-head: consistent Docker database dumps, Compose detection, and restore-drill verification. See who each is for.`}
        basePath={basePath}
        locale={locale}
        localized={false}
        jsonLd={jsonLd}
      />

      <Container>
        <Breadcrumbs
          crumbs={[
            { label: 'Home', basePath: '/' },
            { label: 'Alternatives', basePath: '/alternatives' },
            { label: `vs ${competitor.name}` },
          ]}
          locale={locale}
        />
      </Container>

      <section className={sectionClass}>
        <Container>
          <h1 className={h1Class}>Dockstash vs {competitor.name}</h1>
          <p className={answerClass}>
            {competitor.positioning}
          </p>
        </Container>
      </section>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <Eyebrow>Head to head</Eyebrow>
          <h2 className={h2Class}>At a glance</h2>
          <ComparisonTable
            rows={competitor.comparison}
            competitorName={competitor.name}
          />
        </Container>
      </Reveal>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <h2 className={h2Class}>Who each is for</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg tracking-tight">
                  Choose Dockstash if…
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{competitor.switchIf}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg tracking-tight">
                  Choose {competitor.name} if…
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{competitor.bestFor}</p>
              </CardContent>
            </Card>
          </div>
        </Container>
      </Reveal>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <h2 className={h2Class}>Migrating to Dockstash</h2>
          <p className="max-w-prose">{competitor.migrationNotes}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/register">Start free</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={href(`/alternatives/${competitor.slug}`)}>
                The {competitor.name} alternative in depth
              </Link>
            </Button>
          </div>
          <LastUpdated iso={competitor.lastReviewed} />
        </Container>
      </Reveal>

      <FaqSection faqs={competitor.faq} />
    </>
  );
};
