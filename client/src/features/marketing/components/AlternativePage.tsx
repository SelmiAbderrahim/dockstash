import { Link, useParams } from 'react-router-dom';
import { Seo, SsrNotFound, schema } from '@shared/seo';
import { Button } from '@shared/ui/button';
import { getCompetitor, altIntro } from '@features/marketing/content';
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

const listClass = 'list-disc space-y-1.5 ps-5 text-muted-foreground';

export const AlternativePage = () => {
  const { slug } = useParams();
  const { locale } = useMarketingRoute();
  const href = (path: string) => localeHref(path, locale);
  /* v8 ignore next -- `slug` is guaranteed by the :slug route param; the undefined arm is unreachable */
  const competitor = slug ? getCompetitor(slug) : undefined;

  if (!competitor) {
    return (
      <>
        <Seo
          title="Alternative not found"
          description="This Dockstash alternative page could not be found. Browse all Docker backup alternatives from the alternatives hub."
          basePath="/alternatives"
          locale={locale}
          noindex
        />
        <SsrNotFound />
        <section className={sectionClass}>
          <Container>
            <h1 className={h1Class}>Alternative not found</h1>
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

  const basePath = `/alternatives/${competitor.slug}`;

  const jsonLd = schema.graph(
    ...schema.siteEntities(),
    schema.breadcrumbList([
      { name: 'Home', path: localeHref('/', locale) },
      { name: 'Alternatives', path: localeHref('/alternatives', locale) },
      { name: competitor.name, path: localeHref(basePath, locale) },
    ]),
    schema.faqPage(competitor.faq),
    schema.itemList(
      competitor.comparison.map((row) => ({
        name: row.feature,
        path: localeHref(basePath, locale),
      })),
    ),
  );

  return (
    <>
      <Seo
        title={`The Dockstash alternative to ${competitor.name}`}
        description={`Honest ${competitor.name} vs Dockstash comparison: where each wins, why Docker-aware dumps and restore drills matter, and how to migrate.`}
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
            { label: competitor.name },
          ]}
          locale={locale}
        />
      </Container>

      <section className={sectionClass}>
        <Container>
          <h1 className={h1Class}>
            The Dockstash alternative to {competitor.name}
          </h1>
          <p className={answerClass}>
            {altIntro(competitor)}
          </p>
          <p className="mt-3 text-muted-foreground">
            {competitor.name} — {competitor.category}. {competitor.pricing}.
          </p>
        </Container>
      </section>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <Eyebrow>Comparison</Eyebrow>
          <h2 className={h2Class}>How Dockstash compares to {competitor.name}</h2>
          <ComparisonTable
            rows={competitor.comparison}
            competitorName={competitor.name}
          />
        </Container>
      </Reveal>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <h2 className={h2Class}>Where {competitor.name} is strong</h2>
          <ul className={listClass}>
            {competitor.strengths.map((strength) => (
              <li key={strength}>{strength}</li>
            ))}
          </ul>
          <h2 className={`${h2Class} mt-8`}>Where Dockstash pulls ahead</h2>
          <ul className={listClass}>
            {competitor.weaknesses.map((weakness) => (
              <li key={weakness}>{weakness}</li>
            ))}
          </ul>
        </Container>
      </Reveal>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <h2 className={h2Class}>Who should switch to Dockstash</h2>
          <p className={answerClass}>
            {competitor.switchIf}
          </p>
          <p className="mt-4 text-muted-foreground">
            <strong className="text-foreground">
              {competitor.name} is the right choice when:
            </strong>{' '}
            {competitor.bestFor}
          </p>
        </Container>
      </Reveal>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <h2 className={h2Class}>Migrating from {competitor.name}</h2>
          <p className="max-w-prose">{competitor.migrationNotes}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/register">Start free</Link>
            </Button>
            {competitor.slug === 'backrest' && (
              <Button asChild variant="outline">
                <Link to={href('/vs/backrest')}>
                  Dockstash vs Backrest, head-to-head
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to={href('/alternatives')}>All alternatives</Link>
            </Button>
          </div>
          <LastUpdated iso={competitor.lastReviewed} />
        </Container>
      </Reveal>

      <FaqSection faqs={competitor.faq} />
    </>
  );
};
