import { Link, useParams } from 'react-router-dom';
import { Seo, schema } from '@shared/seo';
import {
  getUseCase,
  getServiceGuide,
  useCaseIntro,
} from '@features/marketing/content';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import {
  Breadcrumbs,
  FaqSection,
  LastUpdated,
} from './shared';

export const UseCasePage = () => {
  const { entry } = useParams();
  const { locale } = useMarketingRoute();
  const href = (path: string) => localeHref(path, locale);
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
        <section className="mk-section">
          <div className="mk-container">
            <h1 className="mk-h1">Backup guide not found</h1>
            <p className="mk-muted">
              We could not find that guide.{' '}
              <Link to={href('/guides')}>See all Docker backup guides</Link>.
            </p>
          </div>
        </section>
      </>
    );
  }

  const basePath = `/backup/${app.slug}-docker`;

  const jsonLd = schema.graph(
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
        description={`Back up ${app.appName} in Docker completely: a consistent dump of its database, the data volumes that hold files, and the compose/.env config — stored encrypted off-site with a verified restore.`}
        basePath={basePath}
        locale={locale}
        jsonLd={jsonLd}
      />

      <div className="mk-container">
        <Breadcrumbs
          crumbs={[
            { label: 'Home', basePath: '/' },
            { label: 'Guides', basePath: '/guides' },
            { label: app.appName },
          ]}
          locale={locale}
        />
      </div>

      <section className="mk-section">
        <div className="mk-container">
          <h1 className="mk-h1">
            How to back up {app.appName} in Docker (2026)
          </h1>
          <p className="mk-answer">{useCaseIntro(app)}</p>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container">
          <h2 className="mk-h2">What {app.appName} stores</h2>
          <table className="mk-table">
            <tbody>
              <tr>
                <th scope="row">Compose services</th>
                <td>{app.composeServices.join(', ')}</td>
              </tr>
              <tr>
                <th scope="row">Databases detected</th>
                <td>{app.detectedDbs.join(', ')}</td>
              </tr>
              <tr>
                <th scope="row">Data volumes</th>
                <td>{app.detectedVolumes.join(', ')}</td>
              </tr>
              <tr>
                <th scope="row">Config paths</th>
                <td>{app.configPaths.join(', ')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container">
          <h2 className="mk-h2">The backup plan</h2>
          <ol>
            {app.backupPlan.map((step) => (
              <li key={step.title} style={{ marginBottom: 12 }}>
                <strong>{step.title}.</strong> {step.detail}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container">
          <h2 className="mk-h2">Restoring {app.appName}</h2>
          <p>{app.restoreNotes}</p>
          <p style={{ marginTop: 20 }}>
            <Link to="/register" className="mk-btn mk-btn--primary">
              Back up {app.appName} in one click
            </Link>{' '}
            <Link to={href('/guides')} className="mk-btn">
              All guides
            </Link>
          </p>
          <LastUpdated iso={app.lastReviewed} />
        </div>
      </section>

      {app.relatedGuides.length > 0 && (
        <section className="mk-section">
          <div className="mk-container">
            <h2 className="mk-h2">Related database guides</h2>
            <div className="mk-grid">
              {app.relatedGuides.map((related) => {
                const relatedGuide = getServiceGuide(related);
                if (!relatedGuide) return null;
                return (
                  <Link
                    key={related}
                    to={href(`/guides/backup-${related}-docker`)}
                    className="mk-card"
                  >
                    <h3>{relatedGuide.serviceName}</h3>
                    <p className="mk-muted">
                      Back up {relatedGuide.serviceName} in Docker
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <FaqSection faqs={app.faq} />
    </>
  );
};
