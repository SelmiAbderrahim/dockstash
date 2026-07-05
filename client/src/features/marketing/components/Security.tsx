import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { Seo, schema } from '@shared/seo';
import { Button } from '@shared/ui/button';
import { cn } from '@shared/lib/utils';
import { localeHref } from '../useMarketingRoute';
import {
  Breadcrumbs,
  Container,
  Eyebrow,
  FaqSection,
  InvertedBand,
  LinkCard,
  Serif,
  answerClass,
  cardClass,
  h1Class,
  h2Class,
  sectionClass,
  useMarketingT,
} from './shared';
import { Reveal } from '../useReveal';
import type { FaqItem } from '../types';

const CARD_KEYS = [
  'secrets',
  'pinning',
  'repos',
  'typedConfirm',
  'drills',
  'lockIn',
] as const;

const SECURITY_FAQ_KEYS = ['secrets', 'holdData', 'destructive', 'disappear'] as const;

export const Security = () => {
  const { t, locale } = useMarketingT();
  const href = (path: string) => localeHref(path, locale);

  const securityFaq: FaqItem[] = SECURITY_FAQ_KEYS.map((key) => ({
    question: t(`security.faq.${key}.question`),
    answer: t(`security.faq.${key}.answer`),
  }));

  const jsonLd = schema.graph(
    ...schema.siteEntities(),
    schema.breadcrumbList([
      { name: t('shared.home'), path: localeHref('/', locale) },
      { name: t('security.breadcrumb'), path: localeHref('/security', locale) },
    ]),
    schema.faqPage(securityFaq),
  );

  return (
    <>
      <Seo
        title={t('security.seo.title')}
        description={t('security.seo.description')}
        basePath="/security"
        locale={locale}
        jsonLd={jsonLd}
      />

      <Container>
        <Breadcrumbs
          crumbs={[
            { label: t('shared.home'), basePath: '/' },
            { label: t('security.breadcrumb') },
          ]}
          locale={locale}
        />
      </Container>

      <section className={sectionClass}>
        <Container>
          <Eyebrow>{t('security.eyebrow')}</Eyebrow>
          <h1 className={h1Class}>{t('security.title')}</h1>
          <p className={answerClass}>{t('security.answer')}</p>
        </Container>
      </section>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <h2 className={h2Class}>{t('security.cardsTitle')}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CARD_KEYS.map((key, i) => (
              <Reveal key={key} className={cn(cardClass, 'space-y-2')} index={i}>
                <h3 className="text-lg font-semibold tracking-tight">
                  {t(`security.cards.${key}.title`)}
                </h3>
                <p className="text-muted-foreground">
                  {t(`security.cards.${key}.body`)}
                </p>
              </Reveal>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/register">{t('shared.startFree')}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={href('/faq')}>{t('security.readFaq')}</Link>
            </Button>
          </div>
        </Container>
      </Reveal>

      <FaqSection faqs={securityFaq} />

      {/* Related content — keep the crawl path flowing */}
      <Reveal as="section" className={sectionClass}>
        <Container>
          <h2 className={h2Class}>{t('security.keepReading')}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <LinkCard
              to={href('/faq')}
              title={t('security.links.faq.title')}
              description={t('security.links.faq.description')}
            />
            <LinkCard
              to={href('/guides')}
              title={t('security.links.guides.title')}
              description={t('security.links.guides.description')}
            />
            <LinkCard
              to={href('/pricing')}
              title={t('security.links.pricing.title')}
              description={t('security.links.pricing.description')}
            />
          </div>
        </Container>
      </Reveal>

      {/* Closing CTA — inverted band */}
      <InvertedBand className="text-center">
        <Container className="max-w-2xl">
          <h2 className={h2Class}>
            {t('security.cta.title.pre')} <Serif>{t('security.cta.title.accent')}</Serif>
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
