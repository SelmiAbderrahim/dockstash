import { Link, useParams } from 'react-router-dom';
import { Seo, schema } from '@shared/seo';
import { getCompetitor } from '@features/marketing/content';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import {
  Breadcrumbs,
  ComparisonTable,
  FaqSection,
  LastUpdated,
} from './shared';

export const VsPage = () => {
  const { slug } = useParams();
  const { locale } = useMarketingRoute();
  const href = (path: string) => localeHref(path, locale);
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
        <section className="mk-section">
          <div className="mk-container">
            <h1 className="mk-h1">Comparison not found</h1>
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

  const basePath = `/vs/${competitor.slug}`;

  const jsonLd = schema.graph(
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
        description={`Dockstash vs ${competitor.name}, head-to-head: consistent Docker database dumps, Compose detection, and restore-drill verification versus ${competitor.category.toLowerCase()}. See who each is for.`}
        basePath={basePath}
        locale={locale}
        jsonLd={jsonLd}
      />

      <div className="mk-container">
        <Breadcrumbs
          crumbs={[
            { label: 'Home', basePath: '/' },
            { label: 'Alternatives', basePath: '/alternatives' },
            { label: `vs ${competitor.name}` },
          ]}
          locale={locale}
        />
      </div>

      <section className="mk-section">
        <div className="mk-container">
          <h1 className="mk-h1">
            Dockstash vs {competitor.name}
          </h1>
          <p className="mk-answer">
            {competitor.positioning}
          </p>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container">
          <h2 className="mk-h2">At a glance</h2>
          <ComparisonTable
            rows={competitor.comparison}
            competitorName={competitor.name}
          />
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container">
          <h2 className="mk-h2">Who each is for</h2>
          <div className="mk-grid">
            <div className="mk-card">
              <h3>Choose Dockstash if…</h3>
              <p className="mk-muted">{competitor.switchIf}</p>
            </div>
            <div className="mk-card">
              <h3>Choose {competitor.name} if…</h3>
              <p className="mk-muted">{competitor.bestFor}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container">
          <h2 className="mk-h2">Migrating to Dockstash</h2>
          <p>{competitor.migrationNotes}</p>
          <p style={{ marginTop: 20 }}>
            <Link to="/register" className="mk-btn mk-btn--primary">
              Start free
            </Link>{' '}
            <Link
              to={href(`/alternatives/${competitor.slug}`)}
              className="mk-btn"
            >
              The {competitor.name} alternative in depth
            </Link>
          </p>
          <LastUpdated iso={competitor.lastReviewed} />
        </div>
      </section>

      <FaqSection faqs={competitor.faq} />
    </>
  );
};
