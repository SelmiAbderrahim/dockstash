import { Link } from 'react-router-dom';
import { Seo, schema } from '@shared/seo';
import { Button } from '@shared/ui/button';
import {
  getPlatformGuide,
  getServiceGuide,
  type PlatformGuideCopy,
} from '@features/marketing/content';
import type { PlatformGuide } from '../types';
import { localeHref } from '../useMarketingRoute';
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
  useMarketingT,
} from './shared';
import { WalkthroughList } from './guide-shared';
import { Reveal } from '../useReveal';

export const PlatformGuideArticle = ({
  guide,
  copy,
}: {
  guide: PlatformGuide;
  copy: PlatformGuideCopy;
}) => {
  const { t, locale } = useMarketingT();
  const href = (path: string) => localeHref(path, locale);
  const basePath = `/guides/${guide.slug}`;
  const title = t(`guides.platform.${guide.slug}.title`);
  const description = t(`guides.platform.${guide.slug}.description`);

  const howToSteps = guide.steps.flatMap((step) => {
    const stepCopy = copy.steps[step.id];
    /* v8 ignore next -- guide-copy tests guarantee copy for every shipped step id */
    if (!stepCopy) return [];
    return [
      {
        name: stepCopy.title,
        text: step.cmd ? `${stepCopy.body} ${step.cmd}` : stepCopy.body,
      },
    ];
  });

  const lastModified = schema.monthToIso(guide.lastReviewed);

  const jsonLd = schema.graph(
    ...schema.siteEntities(),
    schema.article({
      headline: title,
      description,
      path: localeHref(basePath, locale),
      dateModified: lastModified,
      inLanguage: locale,
    }),
    schema.howTo(title, howToSteps),
    schema.breadcrumbList([
      { name: t('shared.home'), path: localeHref('/', locale) },
      { name: t('guides.breadcrumb'), path: localeHref('/guides', locale) },
      { name: title, path: localeHref(basePath, locale) },
    ]),
    schema.faqPage(copy.faq),
  );

  return (
    <>
      <Seo
        title={t(`guides.platform.${guide.slug}.seoTitle`)}
        description={description}
        basePath={basePath}
        locale={locale}
        type="article"
        dateModified={lastModified}
        jsonLd={jsonLd}
      />

      <Container>
        <Breadcrumbs
          crumbs={[
            { label: t('shared.home'), basePath: '/' },
            { label: t('guides.breadcrumb'), basePath: '/guides' },
            { label: title },
          ]}
          locale={locale}
        />
      </Container>

      <section className={sectionClass}>
        <Container>
          <Eyebrow>{t('guides.platformArticle.eyebrow')}</Eyebrow>
          <h1 className={h1Class}>{title}</h1>
          <p className={answerClass}>{copy.intro}</p>
        </Container>
      </section>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <Eyebrow>{t('guides.platformArticle.stepsEyebrow')}</Eyebrow>
          <h2 className={h2Class}>{t('guides.platformArticle.stepsTitle')}</h2>
          <WalkthroughList steps={guide.steps} copy={copy.steps} />
        </Container>
      </Reveal>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <h2 className={h2Class}>{t('guides.article.ctaTitle')}</h2>
          <p className="max-w-prose text-muted-foreground">
            {t('guides.article.ctaBody')}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/register">{t('guides.article.startFree')}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={href('/guides')}>{t('guides.article.allGuides')}</Link>
            </Button>
          </div>
          <LastUpdated iso={guide.lastReviewed} />
        </Container>
      </Reveal>

      {/* v8 ignore next 2 -- shipped platform guides always carry related links; the false arm is unreachable */}
      {(guide.relatedPlatformGuides.length > 0 ||
        guide.relatedServices.length > 0) && (
        <Reveal as="section" className={sectionClass}>
          <Container>
            <h2 className={h2Class}>{t('guides.platformArticle.relatedTitle')}</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {guide.relatedPlatformGuides.map((related) => {
                const relatedGuide = getPlatformGuide(related);
                /* v8 ignore next -- every shipped relatedPlatformGuide slug resolves */
                if (!relatedGuide) return null;
                return (
                  <LinkCard
                    key={`platform-${related}`}
                    to={href(`/guides/${related}`)}
                    title={t(`guides.platform.${related}.title`)}
                    description={t(`guides.platform.${related}.description`)}
                  />
                );
              })}
              {guide.relatedServices.map((related) => {
                const relatedGuide = getServiceGuide(related);
                /* v8 ignore next -- every shipped relatedService slug resolves */
                if (!relatedGuide) return null;
                return (
                  <LinkCard
                    key={`svc-${related}`}
                    to={href(`/guides/backup-${related}-docker`)}
                    title={relatedGuide.serviceName}
                    description={t('guides.hub.cardBackup', {
                      name: relatedGuide.serviceName,
                    })}
                  />
                );
              })}
            </div>
          </Container>
        </Reveal>
      )}

      <FaqSection faqs={copy.faq} />
    </>
  );
};
