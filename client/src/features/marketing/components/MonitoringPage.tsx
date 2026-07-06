import { Link } from 'react-router-dom';
import {
  ActivityIcon,
  ArrowRightIcon,
  BellIcon,
  HeartPulseIcon,
  WebhookIcon,
} from 'lucide-react';
import { Seo, schema } from '@shared/seo';
import { Button } from '@shared/ui/button';
import { localeHref } from '../useMarketingRoute';
import {
  Breadcrumbs,
  Container,
  Eyebrow,
  FaqSection,
  FeatureCard,
  InvertedBand,
  Serif,
  h1Class,
  h2Class,
  sectionClass,
  useMarketingT,
} from './shared';
import { Reveal } from '../useReveal';
import type { FaqItem } from '../types';

const FEATURE_KEYS = ['dashboard', 'alertCenter', 'channels', 'heartbeat'] as const;
const FEATURE_ICONS = {
  dashboard: <ActivityIcon />,
  alertCenter: <BellIcon />,
  channels: <WebhookIcon />,
  heartbeat: <HeartPulseIcon />,
} as const;
const FAQ_KEYS = ['signals', 'channels', 'silent'] as const;

export const MonitoringPage = () => {
  const { t, locale } = useMarketingT();
  const href = (path: string) => localeHref(path, locale);

  const faq: FaqItem[] = FAQ_KEYS.map((key) => ({
    question: t(`monitoring.faq.${key}.question`),
    answer: t(`monitoring.faq.${key}.answer`),
  }));

  const jsonLd = schema.graph(
    ...schema.siteEntities(),
    schema.breadcrumbList([
      { name: t('shared.home'), path: localeHref('/', locale) },
      { name: t('monitoring.breadcrumb'), path: localeHref('/backup-monitoring', locale) },
    ]),
    schema.faqPage(faq),
  );

  return (
    <>
      <Seo
        title={t('monitoring.seo.title')}
        description={t('monitoring.seo.description')}
        basePath="/backup-monitoring"
        locale={locale}
        jsonLd={jsonLd}
      />

      <Container>
        <Breadcrumbs
          crumbs={[
            { label: t('shared.home'), basePath: '/' },
            { label: t('monitoring.breadcrumb') },
          ]}
          locale={locale}
        />

        <section className={sectionClass}>
          <Reveal>
            <Eyebrow>{t('monitoring.eyebrow')}</Eyebrow>
            <h1 className={h1Class}>
              {t('monitoring.hero.titleLead')} <Serif>{t('monitoring.hero.titleAccent')}</Serif>
            </h1>
            <p className="mt-6 max-w-[560px] text-muted-foreground">
              {t('monitoring.hero.subtitle')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link to={href('/pricing')}>
                  {t('monitoring.hero.ctaPrimary')}
                  <ArrowRightIcon className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={href('/continuous-backup')}>
                  {t('monitoring.hero.ctaSecondary')}
                </Link>
              </Button>
            </div>
          </Reveal>
        </section>

        <section className={sectionClass}>
          <h2 className={h2Class}>{t('monitoring.features.heading')}</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {FEATURE_KEYS.map((key) => (
              <FeatureCard
                key={key}
                icon={FEATURE_ICONS[key]}
                title={t(`monitoring.features.${key}.title`)}
              >
                {t(`monitoring.features.${key}.body`)}
              </FeatureCard>
            ))}
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className={h2Class}>{t('monitoring.states.heading')}</h2>
          <p className="mt-4 max-w-[560px] text-muted-foreground">
            {t('monitoring.states.body')}
          </p>
          <ul className="mt-8 flex flex-col gap-4">
            {(['healthy', 'degraded', 'critical'] as const).map((key) => (
              <li key={key} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={
                    key === 'healthy'
                      ? 'mt-1.5 size-2 rounded-full bg-success'
                      : key === 'degraded'
                        ? 'mt-1.5 size-2 rounded-full bg-warning'
                        : 'mt-1.5 size-2 rounded-full bg-destructive'
                  }
                />
                <div>
                  <p className="text-sm font-medium">{t(`monitoring.states.${key}.title`)}</p>
                  <p className="text-sm text-muted-foreground">
                    {t(`monitoring.states.${key}.body`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={sectionClass}>
          <h2 className={h2Class}>{t('monitoring.faq.heading')}</h2>
          <div className="mt-8">
            <FaqSection faqs={faq} />
          </div>
        </section>
      </Container>

      <InvertedBand>
        <Container>
          <h2 className={h2Class}>{t('monitoring.cta.heading')}</h2>
          <p className="mt-4 max-w-[560px] text-muted-foreground">{t('monitoring.cta.body')}</p>
          <div className="mt-8">
            <Button asChild>
              <Link to={href('/pricing')}>
                {t('monitoring.cta.button')}
                <ArrowRightIcon className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </Container>
      </InvertedBand>
    </>
  );
};
