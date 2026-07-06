import { Link } from 'react-router-dom';
import { ArrowRightIcon, ClockIcon, DatabaseZapIcon, HistoryIcon, LayersIcon } from 'lucide-react';
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

const FEATURE_KEYS = ['cadence', 'dedup', 'pitr', 'retention'] as const;
const FEATURE_ICONS = {
  cadence: <ClockIcon />,
  dedup: <LayersIcon />,
  pitr: <HistoryIcon />,
  retention: <DatabaseZapIcon />,
} as const;
const STEP_KEYS = ['enable', 'accumulate', 'restore'] as const;
const FAQ_KEYS = ['rpo', 'cost', 'restore'] as const;

export const ContinuousBackupPage = () => {
  const { t, locale } = useMarketingT();
  const href = (path: string) => localeHref(path, locale);

  const faq: FaqItem[] = FAQ_KEYS.map((key) => ({
    question: t(`continuousBackup.faq.${key}.question`),
    answer: t(`continuousBackup.faq.${key}.answer`),
  }));

  const jsonLd = schema.graph(
    ...schema.siteEntities(),
    schema.breadcrumbList([
      { name: t('shared.home'), path: localeHref('/', locale) },
      { name: t('continuousBackup.breadcrumb'), path: localeHref('/continuous-backup', locale) },
    ]),
    schema.faqPage(faq),
  );

  return (
    <>
      <Seo
        title={t('continuousBackup.seo.title')}
        description={t('continuousBackup.seo.description')}
        basePath="/continuous-backup"
        locale={locale}
        jsonLd={jsonLd}
      />

      <Container>
        <Breadcrumbs
          crumbs={[
            { label: t('shared.home'), basePath: '/' },
            { label: t('continuousBackup.breadcrumb') },
          ]}
          locale={locale}
        />

        <section className={sectionClass}>
          <Reveal>
            <Eyebrow>{t('continuousBackup.eyebrow')}</Eyebrow>
            <h1 className={h1Class}>
              {t('continuousBackup.hero.titleLead')}{' '}
              <Serif>{t('continuousBackup.hero.titleAccent')}</Serif>
            </h1>
            <p className="mt-6 max-w-[560px] text-muted-foreground">
              {t('continuousBackup.hero.subtitle')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link to={href('/pricing')}>
                  {t('continuousBackup.hero.ctaPrimary')}
                  <ArrowRightIcon className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={href('/backup-monitoring')}>
                  {t('continuousBackup.hero.ctaSecondary')}
                </Link>
              </Button>
            </div>
          </Reveal>
        </section>

        <section className={sectionClass}>
          <h2 className={h2Class}>{t('continuousBackup.features.heading')}</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {FEATURE_KEYS.map((key) => (
              <FeatureCard
                key={key}
                icon={FEATURE_ICONS[key]}
                title={t(`continuousBackup.features.${key}.title`)}
              >
                {t(`continuousBackup.features.${key}.body`)}
              </FeatureCard>
            ))}
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className={h2Class}>{t('continuousBackup.how.heading')}</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {STEP_KEYS.map((key, i) => (
              <li key={key} className="flex flex-col gap-3">
                <span className="font-serif text-4xl italic text-muted-foreground/40">
                  {`0${i + 1}`}
                </span>
                <span aria-hidden="true" className="h-px w-10 bg-border" />
                <h3 className="text-lg font-semibold tracking-tight">
                  {t(`continuousBackup.how.${key}.title`)}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t(`continuousBackup.how.${key}.body`)}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className={sectionClass}>
          <h2 className={h2Class}>{t('continuousBackup.faq.heading')}</h2>
          <div className="mt-8">
            <FaqSection faqs={faq} />
          </div>
        </section>
      </Container>

      <InvertedBand>
        <Container>
          <h2 className={h2Class}>{t('continuousBackup.cta.heading')}</h2>
          <p className="mt-4 max-w-[560px] text-muted-foreground">
            {t('continuousBackup.cta.body')}
          </p>
          <div className="mt-8">
            <Button asChild>
              <Link to={href('/pricing')}>
                {t('continuousBackup.cta.button')}
                <ArrowRightIcon className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </Container>
      </InvertedBand>
    </>
  );
};
