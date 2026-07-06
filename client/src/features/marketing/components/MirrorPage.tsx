import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  CopyIcon,
  FolderSyncIcon,
  ShieldCheckIcon,
  TimerResetIcon,
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

const FEATURE_KEYS = ['oneWay', 'pointInTime', 'allowlist', 'scheduled'] as const;
const FEATURE_ICONS = {
  oneWay: <FolderSyncIcon />,
  pointInTime: <CopyIcon />,
  allowlist: <ShieldCheckIcon />,
  scheduled: <TimerResetIcon />,
} as const;
const STEP_KEYS = ['configure', 'schedule', 'replicate'] as const;
const FAQ_KEYS = ['twoWay', 'deletes', 'plan'] as const;

export const MirrorPage = () => {
  const { t, locale } = useMarketingT();
  const href = (path: string) => localeHref(path, locale);

  const faq: FaqItem[] = FAQ_KEYS.map((key) => ({
    question: t(`mirror.faq.${key}.question`),
    answer: t(`mirror.faq.${key}.answer`),
  }));

  const jsonLd = schema.graph(
    ...schema.siteEntities(),
    schema.breadcrumbList([
      { name: t('shared.home'), path: localeHref('/', locale) },
      { name: t('mirror.breadcrumb'), path: localeHref('/mirror', locale) },
    ]),
    schema.faqPage(faq),
  );

  return (
    <>
      <Seo
        title={t('mirror.seo.title')}
        description={t('mirror.seo.description')}
        basePath="/mirror"
        locale={locale}
        jsonLd={jsonLd}
      />

      <Container>
        <Breadcrumbs
          crumbs={[
            { label: t('shared.home'), basePath: '/' },
            { label: t('mirror.breadcrumb') },
          ]}
          locale={locale}
        />

        <section className={sectionClass}>
          <Reveal>
            <Eyebrow>{t('mirror.eyebrow')}</Eyebrow>
            <h1 className={h1Class}>
              {t('mirror.hero.titleLead')} <Serif>{t('mirror.hero.titleAccent')}</Serif>
            </h1>
            <p className="mt-6 max-w-[560px] text-muted-foreground">
              {t('mirror.hero.subtitle')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link to={href('/pricing')}>
                  {t('mirror.hero.ctaPrimary')}
                  <ArrowRightIcon className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={href('/security')}>{t('mirror.hero.ctaSecondary')}</Link>
              </Button>
            </div>
          </Reveal>
        </section>

        <section className={sectionClass}>
          <h2 className={h2Class}>{t('mirror.features.heading')}</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {FEATURE_KEYS.map((key) => (
              <FeatureCard
                key={key}
                icon={FEATURE_ICONS[key]}
                title={t(`mirror.features.${key}.title`)}
              >
                {t(`mirror.features.${key}.body`)}
              </FeatureCard>
            ))}
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className={h2Class}>{t('mirror.how.heading')}</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {STEP_KEYS.map((key, i) => (
              <li key={key} className="flex flex-col gap-3">
                <span className="font-serif text-4xl italic text-muted-foreground/40">
                  {`0${i + 1}`}
                </span>
                <span aria-hidden="true" className="h-px w-10 bg-border" />
                <h3 className="text-lg font-semibold tracking-tight">
                  {t(`mirror.how.${key}.title`)}
                </h3>
                <p className="text-sm text-muted-foreground">{t(`mirror.how.${key}.body`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={sectionClass}>
          <h2 className={h2Class}>{t('mirror.faq.heading')}</h2>
          <div className="mt-8">
            <FaqSection faqs={faq} />
          </div>
        </section>
      </Container>

      <InvertedBand>
        <Container>
          <h2 className={h2Class}>{t('mirror.cta.heading')}</h2>
          <p className="mt-4 max-w-[560px] text-muted-foreground">{t('mirror.cta.body')}</p>
          <div className="mt-8">
            <Button asChild>
              <Link to={href('/pricing')}>
                {t('mirror.cta.button')}
                <ArrowRightIcon className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </Container>
      </InvertedBand>
    </>
  );
};
