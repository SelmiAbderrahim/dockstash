import { Seo, schema } from '@shared/seo';
import {
  PLATFORM_GUIDE_SLUGS,
  SERVICE_GUIDES,
  SERVICE_GUIDE_SLUGS,
  USE_CASES,
  USE_CASE_SLUGS,
} from '@features/marketing/content';
import { localeHref } from '../useMarketingRoute';
import {
  Breadcrumbs,
  Container,
  Eyebrow,
  FaqSection,
  LinkCard,
  answerClass,
  h1Class,
  h2Class,
  sectionClass,
  useMarketingT,
} from './shared';
import { Reveal } from '../useReveal';

const HUB_FAQ_KEYS = ['volumeCopy', 'guideVsUseCase', 'automation'] as const;

export const GuidesHub = () => {
  const { t, locale } = useMarketingT();
  const href = (path: string) => localeHref(path, locale);

  const hubFaq = HUB_FAQ_KEYS.map((key) => ({
    question: t(`guides.hub.faq.${key}.question`),
    answer: t(`guides.hub.faq.${key}.answer`),
  }));

  const platformEntries = PLATFORM_GUIDE_SLUGS.map((slug) => ({
    name: t(`guides.platform.${slug}.title`),
    path: localeHref(`/guides/${slug}`, locale),
  }));
  const guideEntries = SERVICE_GUIDE_SLUGS.map((slug) => ({
    name: t('guides.hub.cardBackup', { name: SERVICE_GUIDES[slug]!.serviceName }),
    path: localeHref(`/guides/backup-${slug}-docker`, locale),
  }));
  const useCaseEntries = USE_CASE_SLUGS.map((slug) => ({
    name: t('guides.hub.cardBackup', { name: USE_CASES[slug]!.appName }),
    path: localeHref(`/backup/${slug}-docker`, locale),
  }));

  const jsonLd = schema.graph(
    ...schema.siteEntities(),
    schema.itemList([...platformEntries, ...guideEntries, ...useCaseEntries]),
    schema.breadcrumbList([
      { name: t('shared.home'), path: localeHref('/', locale) },
      { name: t('guides.breadcrumb'), path: localeHref('/guides', locale) },
    ]),
    schema.faqPage(hubFaq),
  );

  return (
    <>
      <Seo
        title={t('guides.hub.seoTitle')}
        description={t('guides.hub.seoDescription')}
        basePath="/guides"
        locale={locale}
        jsonLd={jsonLd}
      />

      <Container>
        <Breadcrumbs
          crumbs={[
            { label: t('shared.home'), basePath: '/' },
            { label: t('guides.breadcrumb') },
          ]}
          locale={locale}
        />
      </Container>

      <section className={sectionClass}>
        <Container>
          <Eyebrow>{t('guides.hub.eyebrow')}</Eyebrow>
          <h1 className={h1Class}>{t('guides.hub.title')}</h1>
          <p className={answerClass}>{t('guides.hub.answer')}</p>
        </Container>
      </section>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <Eyebrow>{t('guides.hub.platformEyebrow')}</Eyebrow>
          <h2 className={h2Class}>{t('guides.hub.platformTitle')}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PLATFORM_GUIDE_SLUGS.map((slug) => (
              <LinkCard
                key={slug}
                to={href(`/guides/${slug}`)}
                title={t(`guides.platform.${slug}.title`)}
                description={t(`guides.platform.${slug}.description`)}
              />
            ))}
          </div>
        </Container>
      </Reveal>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <Eyebrow>{t('guides.hub.databaseEyebrow')}</Eyebrow>
          <h2 className={h2Class}>{t('guides.hub.databaseTitle')}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICE_GUIDE_SLUGS.map((slug) => {
              const guide = SERVICE_GUIDES[slug]!;
              return (
                <LinkCard
                  key={slug}
                  to={href(`/guides/backup-${slug}-docker`)}
                  title={guide.serviceName}
                  description={t('guides.hub.cardBackup', {
                    name: guide.serviceName,
                  })}
                />
              );
            })}
          </div>
        </Container>
      </Reveal>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <Eyebrow>{t('guides.hub.appEyebrow')}</Eyebrow>
          <h2 className={h2Class}>{t('guides.hub.appTitle')}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {USE_CASE_SLUGS.map((slug) => {
              const app = USE_CASES[slug]!;
              return (
                <LinkCard
                  key={slug}
                  to={href(`/backup/${slug}-docker`)}
                  title={app.appName}
                  description={app.category}
                />
              );
            })}
          </div>
        </Container>
      </Reveal>

      <FaqSection faqs={hubFaq} />
    </>
  );
};
