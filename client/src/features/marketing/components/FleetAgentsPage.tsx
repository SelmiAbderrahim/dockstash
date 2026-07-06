import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { Seo, schema } from '@shared/seo';
import { Button } from '@shared/ui/button';
import { localeHref } from '../useMarketingRoute';
import {
  Breadcrumbs,
  Container,
  Eyebrow,
  FaqSection,
  InvertedBand,
  Serif,
  TerminalFrame,
  codeClass,
  h1Class,
  h2Class,
  sectionClass,
  useMarketingT,
} from './shared';
import { Reveal } from '../useReveal';
import type { FaqItem } from '../types';

const STEP_KEYS = ['register', 'install', 'assign'] as const;
const FAQ_KEYS = ['multiVps', 'rootPorts', 'auth'] as const;

const INSTALL_SNIPPET = `docker compose -f docker-compose.agent.yml up -d
# DOCKSTASH_URL=https://dockstash.com
# DOCKSTASH_AGENT_TOKEN=<AGENT_TOKEN>`;

export const FleetAgentsPage = () => {
  const { t, locale } = useMarketingT();
  const href = (path: string) => localeHref(path, locale);

  const faq: FaqItem[] = FAQ_KEYS.map((key) => ({
    question: t(`fleetAgents.faq.${key}.question`),
    answer: t(`fleetAgents.faq.${key}.answer`),
  }));

  const jsonLd = schema.graph(
    ...schema.siteEntities(),
    schema.breadcrumbList([
      { name: t('shared.home'), path: localeHref('/', locale) },
      { name: t('fleetAgents.breadcrumb'), path: localeHref('/fleet-agents', locale) },
    ]),
    schema.faqPage(faq),
  );

  return (
    <>
      <Seo
        title={t('fleetAgents.seo.title')}
        description={t('fleetAgents.seo.description')}
        basePath="/fleet-agents"
        locale={locale}
        jsonLd={jsonLd}
      />

      <Container>
        <Breadcrumbs
          crumbs={[
            { label: t('shared.home'), basePath: '/' },
            { label: t('fleetAgents.breadcrumb') },
          ]}
          locale={locale}
        />

        <section className={sectionClass}>
          <Reveal>
            <Eyebrow>{t('fleetAgents.eyebrow')}</Eyebrow>
            <h1 className={h1Class}>
              {t('fleetAgents.hero.titleLead')} <Serif>{t('fleetAgents.hero.titleAccent')}</Serif>
            </h1>
            <p className="mt-6 max-w-[560px] text-muted-foreground">
              {t('fleetAgents.hero.subtitle')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link to={href('/pricing')}>
                  {t('fleetAgents.hero.ctaPrimary')}
                  <ArrowRightIcon className="size-4 rtl:-scale-x-100" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={href('/security')}>{t('fleetAgents.hero.ctaSecondary')}</Link>
              </Button>
            </div>
          </Reveal>
        </section>

        <section className={sectionClass}>
          <h2 className={h2Class}>{t('fleetAgents.how.heading')}</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {STEP_KEYS.map((key, i) => (
              <li key={key} className="flex flex-col gap-3">
                <span className="font-serif text-4xl italic text-muted-foreground/40">
                  {`0${i + 1}`}
                </span>
                <span aria-hidden="true" className="h-px w-10 bg-border" />
                <h3 className="text-lg font-semibold tracking-tight">
                  {t(`fleetAgents.how.${key}.title`)}
                </h3>
                <p className="text-sm text-muted-foreground">{t(`fleetAgents.how.${key}.body`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={sectionClass}>
          <h2 className={h2Class}>{t('fleetAgents.install.heading')}</h2>
          <p className="mt-4 max-w-[560px] text-muted-foreground">
            {t('fleetAgents.install.body')}
          </p>
          <TerminalFrame className="mt-8" title="docker-compose.agent.yml">
            <pre className="overflow-x-auto p-4">
              <code className={codeClass}>{INSTALL_SNIPPET}</code>
            </pre>
          </TerminalFrame>
        </section>

        <section className={sectionClass}>
          <h2 className={h2Class}>{t('fleetAgents.faq.heading')}</h2>
          <div className="mt-8">
            <FaqSection faqs={faq} />
          </div>
        </section>
      </Container>

      <InvertedBand>
        <Container>
          <h2 className={h2Class}>{t('fleetAgents.cta.heading')}</h2>
          <p className="mt-4 max-w-[560px] text-muted-foreground">{t('fleetAgents.cta.body')}</p>
          <div className="mt-8">
            <Button asChild>
              <Link to={href('/pricing')}>
                {t('fleetAgents.cta.button')}
                <ArrowRightIcon className="size-4 rtl:-scale-x-100" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </Container>
      </InvertedBand>
    </>
  );
};
