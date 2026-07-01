import { Link, useParams } from 'react-router-dom';
import { Seo, schema } from '@shared/seo';
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
  FaqSection,
  LastUpdated,
} from './shared';

export const GuidePage = () => {
  const { entry } = useParams();
  const { locale } = useMarketingRoute();
  const href = (path: string) => localeHref(path, locale);
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
        <section className="mk-section">
          <div className="mk-container">
            <h1 className="mk-h1">Guide not found</h1>
            <p className="mk-muted">
              We could not find that guide.{' '}
              <Link to={href('/guides')}>See all Docker backup guides</Link>.
            </p>
          </div>
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

  const jsonLd = schema.graph(
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
        description={`How to back up ${guide.serviceName} in Docker the correct way: a consistent dump with ${guide.dumpCmd.split(' ')[0]} from the running container, encrypted off-site Restic snapshots, and a verified restore.`}
        basePath={basePath}
        locale={locale}
        jsonLd={jsonLd}
      />

      <div className="mk-container">
        <Breadcrumbs
          crumbs={[
            { label: 'Home', basePath: '/' },
            { label: 'Guides', basePath: '/guides' },
            { label: guide.serviceName },
          ]}
          locale={locale}
        />
      </div>

      <section className="mk-section">
        <div className="mk-container">
          <h1 className="mk-h1">
            How to back up a {guide.serviceName} Docker container (2026)
          </h1>
          <p className="mk-answer">{guideIntro(guide)}</p>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container">
          <h2 className="mk-h2">What Dockstash detects</h2>
          <table className="mk-table">
            <tbody>
              <tr>
                <th scope="row">Env keys detected</th>
                <td>{guide.envKeysDetected.join(', ')}</td>
              </tr>
              <tr>
                <th scope="row">Default port</th>
                <td>{guide.defaultPort || '—'}</td>
              </tr>
              <tr>
                <th scope="row">Live data paths (never copied live)</th>
                <td>{guide.liveDataPaths.join(', ')}</td>
              </tr>
              <tr>
                <th scope="row">Example images</th>
                <td>{guide.dockerImages.join(', ')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container">
          <h2 className="mk-h2">The dump command</h2>
          <CodeBlock>{guide.dumpCmd}</CodeBlock>
          <h2 className="mk-h2" style={{ marginTop: 32 }}>
            The restore command
          </h2>
          <CodeBlock>{guide.restoreCmd}</CodeBlock>
          <p className="mk-muted" style={{ marginTop: 16 }}>
            {consistencyNote(guide)}
          </p>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container">
          <h2 className="mk-h2">Gotchas to avoid</h2>
          <ul>
            {guide.gotchas.map((gotcha) => (
              <li key={gotcha}>{gotcha}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container">
          <h2 className="mk-h2">Do it in one click with Dockstash</h2>
          <p className="mk-muted">
            Dockstash runs the exact dump above, restics it off-site, and
            drill-tests the restore automatically — no script to maintain.
          </p>
          <p style={{ marginTop: 20 }}>
            <Link to="/register" className="mk-btn mk-btn--primary">
              Start free
            </Link>{' '}
            <Link to={href('/guides')} className="mk-btn">
              All guides
            </Link>
          </p>
          <LastUpdated iso={guide.lastReviewed} />
        </div>
      </section>

      {(guide.relatedServices.length > 0 ||
        guide.relatedUseCases.length > 0) && (
        <section className="mk-section">
          <div className="mk-container">
            <h2 className="mk-h2">Related</h2>
            <div className="mk-grid">
              {guide.relatedServices.map((related) => {
                const relatedGuide = getServiceGuide(related);
                if (!relatedGuide) return null;
                return (
                  <Link
                    key={`svc-${related}`}
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
              {guide.relatedUseCases.map((related) => {
                const relatedApp = getUseCase(related);
                if (!relatedApp) return null;
                return (
                  <Link
                    key={`app-${related}`}
                    to={href(`/backup/${related}-docker`)}
                    className="mk-card"
                  >
                    <h3>{relatedApp.appName}</h3>
                    <p className="mk-muted">{relatedApp.category}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <FaqSection faqs={guide.faq} />
    </>
  );
};
