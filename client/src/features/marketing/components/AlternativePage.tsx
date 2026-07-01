import { Link, useParams } from 'react-router-dom';
import { Seo, schema } from '@shared/seo';
import { getCompetitor, altIntro } from '@features/marketing/content';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import { Reveal } from '../useReveal';
import {
  Breadcrumbs,
  ComparisonTable,
  FaqSection,
  LastUpdated,
} from './shared';

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
        <section className="mk-section">
          <div className="mk-container">
            <h1 className="mk-h1">Alternative not found</h1>
            <p className="mk-muted">
              We could not find that comparison.{' '}
              <Link to={href('/alternatives')}>
                See all Dockstash alternatives
              </Link>
              .
            </p>
          </div>
        </section>
      </>
    );
  }

  const basePath = `/alternatives/${competitor.slug}`;

  const jsonLd = schema.graph(
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
        description={`Honest ${competitor.name} vs Dockstash comparison: where ${competitor.name} wins, where Docker-aware dumps and restore-drill verification make Dockstash the better fit, and how to migrate.`}
        basePath={basePath}
        locale={locale}
        jsonLd={jsonLd}
      />

      <div className="mk-container">
        <Breadcrumbs
          crumbs={[
            { label: 'Home', basePath: '/' },
            { label: 'Alternatives', basePath: '/alternatives' },
            { label: competitor.name },
          ]}
          locale={locale}
        />
      </div>

      <section className="mk-section">
        <div className="mk-container">
          <h1 className="mk-h1">
            The Dockstash alternative to {competitor.name}
          </h1>
          <p className="mk-answer">{altIntro(competitor)}</p>
          <p className="mk-muted" style={{ marginTop: 12 }}>
            {competitor.name} — {competitor.category}. {competitor.pricing}.
          </p>
        </div>
      </section>

      <Reveal as="section" className="mk-section">
        <div className="mk-container">
          <span className="mk-eyebrow">Comparison</span>
          <h2 className="mk-h2">How Dockstash compares to {competitor.name}</h2>
          <div className="mk-table-wrap">
            <ComparisonTable
              rows={competitor.comparison}
              competitorName={competitor.name}
            />
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className="mk-section">
        <div className="mk-container">
          <h2 className="mk-h2">Where {competitor.name} is strong</h2>
          <ul>
            {competitor.strengths.map((strength) => (
              <li key={strength}>{strength}</li>
            ))}
          </ul>
          <h2 className="mk-h2" style={{ marginTop: 32 }}>
            Where Dockstash pulls ahead
          </h2>
          <ul>
            {competitor.weaknesses.map((weakness) => (
              <li key={weakness}>{weakness}</li>
            ))}
          </ul>
        </div>
      </Reveal>

      <Reveal as="section" className="mk-section">
        <div className="mk-container">
          <h2 className="mk-h2">Who should switch to Dockstash</h2>
          <p className="mk-answer">{competitor.switchIf}</p>
          <p className="mk-muted" style={{ marginTop: 16 }}>
            <strong>{competitor.name} is the right choice when:</strong>{' '}
            {competitor.bestFor}
          </p>
        </div>
      </Reveal>

      <Reveal as="section" className="mk-section">
        <div className="mk-container">
          <h2 className="mk-h2">Migrating from {competitor.name}</h2>
          <p>{competitor.migrationNotes}</p>
          <p style={{ marginTop: 20 }}>
            <Link to="/register" className="mk-btn mk-btn--primary">
              Start free
            </Link>{' '}
            {competitor.slug === 'backrest' && (
              <Link to={href('/vs/backrest')} className="mk-btn">
                Dockstash vs Backrest, head-to-head
              </Link>
            )}{' '}
            <Link to={href('/alternatives')} className="mk-btn">
              All alternatives
            </Link>
          </p>
          <LastUpdated iso={competitor.lastReviewed} />
        </div>
      </Reveal>

      <FaqSection faqs={competitor.faq} />
    </>
  );
};
