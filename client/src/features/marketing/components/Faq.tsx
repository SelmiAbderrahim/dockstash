import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { Seo, schema } from '@shared/seo';
import { Button } from '@shared/ui/button';
import { localeHref } from '../useMarketingRoute';
import { Reveal } from '../useReveal';
import {
  Breadcrumbs,
  Container,
  Eyebrow,
  FaqSection,
  InvertedBand,
  LinkCard,
  Serif,
  answerClass,
  h1Class,
  h2Class,
  sectionClass,
  useMarketingT,
} from './shared';
import { PLAN_FACTS } from './Pricing';
import type { FaqItem } from '../types';

const SITE_FAQ_KEYS = [
  'what',
  'whyNotBackrest',
  'whyNotDiy',
  'safe',
  'shutdown',
  'restoreProof',
  'engines',
  'config',
  'storage',
  'cost',
] as const;

export const Faq = () => {
  const { t, locale } = useMarketingT();
  const href = (path: string) => localeHref(path, locale);

  // One built array feeds both the visible accordion and the JSON-LD FAQPage.
  // The `cost` answer interpolates real plan facts so prices cannot drift.
  const siteFaq: FaqItem[] = SITE_FAQ_KEYS.map((key) => ({
    question: t(`faq.items.${key}.question`),
    answer: t(`faq.items.${key}.answer`, PLAN_FACTS),
  }));

  const jsonLd = schema.graph(
    schema.faqPage(siteFaq),
    schema.breadcrumbList([
      { name: t('shared.home'), path: localeHref('/', locale) },
      { name: t('faq.breadcrumb'), path: localeHref('/faq', locale) },
    ]),
  );

  return (
    <>
      <Seo
        title={t('faq.seo.title')}
        description={t('faq.seo.description')}
        basePath="/faq"
        locale={locale}
        jsonLd={jsonLd}
      />

      <Container>
        <Breadcrumbs
          crumbs={[
            { label: t('shared.home'), basePath: '/' },
            { label: t('faq.breadcrumb') },
          ]}
          locale={locale}
        />
      </Container>

      <section className={sectionClass}>
        <Container>
          <Eyebrow>{t('faq.eyebrow')}</Eyebrow>
          <h1 className={h1Class}>{t('faq.title')}</h1>
          <p className={answerClass}>{t('faq.answer')}</p>
        </Container>
      </section>

      <FaqSection faqs={siteFaq} />

      {/* Related content — keep the crawl path flowing */}
      <Reveal as="section" className={sectionClass}>
        <Container>
          <h2 className={h2Class}>{t('faq.keepReading')}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <LinkCard
              to={href('/security')}
              title={t('faq.links.security.title')}
              description={t('faq.links.security.description')}
            />
            <LinkCard
              to={href('/pricing')}
              title={t('faq.links.pricing.title')}
              description={t('faq.links.pricing.description')}
            />
            <LinkCard
              to={href('/guides')}
              title={t('faq.links.guides.title')}
              description={t('faq.links.guides.description')}
            />
          </div>
        </Container>
      </Reveal>

      {/* Closing CTA — inverted band */}
      <InvertedBand className="text-center">
        <Container className="max-w-2xl">
          <h2 className={h2Class}>
            {t('faq.cta.title.pre')} <Serif>{t('faq.cta.title.accent')}</Serif>
          </h2>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/register">
                {t('shared.startFree')}
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </Container>
      </InvertedBand>
    </>
  );
};
