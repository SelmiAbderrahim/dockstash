// Dispatcher for /guides/:entry. Platform slugs (e.g. connect-fleet-agent)
// match verbatim; database guides use the backup-<slug>-docker URL shape.
// The locale's copy bundle is preloaded by entry-server (SSR) and
// entry-client (hydration); the loading branch only renders on a cold
// client-side navigation while the locale chunk downloads.

import { Link, useParams } from 'react-router-dom';
import { Seo, SsrNotFound } from '@shared/seo';
import {
  getPlatformGuide,
  getServiceGuide,
  useGuideCopy,
} from '@features/marketing/content';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import {
  Container,
  h1Class,
  sectionClass,
  useMarketingT,
} from './shared';
import { GuideLoading } from './guide-shared';
import { ServiceGuideArticle } from './ServiceGuideArticle';
import { PlatformGuideArticle } from './PlatformGuideArticle';

export const GuidePage = () => {
  const { entry } = useParams();
  const { locale } = useMarketingRoute();
  const { t } = useMarketingT();
  const bundle = useGuideCopy(locale);
  /* v8 ignore next 2 -- `entry` is route-guaranteed; the undefined arm is unreachable */
  const rawEntry = entry ?? '';

  const platform = getPlatformGuide(rawEntry);
  const serviceSlug = rawEntry.replace(/^backup-/, '').replace(/-docker$/, '');
  const service = serviceSlug ? getServiceGuide(serviceSlug) : undefined;

  if (!bundle && (platform || service)) {
    return <GuideLoading label={t('guides.article.loading')} />;
  }

  if (bundle && platform) {
    const copy = bundle.platform[platform.slug];
    /* v8 ignore next -- guide-copy tests guarantee copy for every shipped platform slug */
    if (copy) return <PlatformGuideArticle guide={platform} copy={copy} />;
  }

  if (bundle && service) {
    const copy = bundle.services[service.slug];
    /* v8 ignore next 3 -- guide-copy tests guarantee copy for every shipped service slug */
    if (copy) {
      return <ServiceGuideArticle guide={service} copy={copy} bundle={bundle} />;
    }
  }

  return (
    <>
      <Seo
        title={t('guides.article.notFound.seoTitle')}
        description={t('guides.article.notFound.seoDescription')}
        basePath="/guides"
        locale={locale}
        noindex
      />
      <SsrNotFound />
      <section className={sectionClass}>
        <Container>
          <h1 className={h1Class}>{t('guides.article.notFound.title')}</h1>
          <p className="text-muted-foreground">
            {t('guides.article.notFound.body')}{' '}
            <Link
              to={localeHref('/guides', locale)}
              className="text-primary underline-offset-4 hover:underline"
            >
              {t('guides.article.notFound.link')}
            </Link>
            .
          </p>
        </Container>
      </section>
    </>
  );
};
