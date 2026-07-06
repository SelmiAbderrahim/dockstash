import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckIcon } from 'lucide-react';
import { Seo, schema } from '@shared/seo';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { cn } from '@shared/lib/utils';
import { localeHref } from '../useMarketingRoute';
import {
  Breadcrumbs,
  Container,
  Eyebrow,
  FaqSection,
  answerClass,
  cardClass,
  h1Class,
  sectionClass,
  useMarketingT,
} from './shared';
import { Reveal } from '../useReveal';
import type { FaqItem } from '../types';

/**
 * Plan facts (prices, limits) are product data, not copy — they stay in TSX
 * and interpolate into the marketing-namespace strings via `{{var}}` slots,
 * so translators can never drift a price.
 */
export const PLAN_FACTS = {
  freePrice: '$0',
  proMonthly: '$9',
  bizMonthly: '$29',
  proYearly: '$90',
  bizYearly: '$290',
  freeRetentionDays: 7,
  proRetentionDays: 30,
  bizRetentionDays: 90,
  freeProjects: 1,
  proProjects: 10,
} as const;

type BillingPeriod = 'monthly' | 'yearly';

interface Tier {
  name: string;
  /** Emphasized tier — badge, primary border, solid CTA. */
  popular?: boolean;
  price: Record<BillingPeriod, string>;
  cadence: Record<BillingPeriod, string>;
  /** Always-in-SSR yearly note (AEO: yearly figures must exist in the HTML). */
  yearly?: string;
  tagline: string;
  features: string[];
  cta: { label: string; to: string };
}

const PRICING_FAQ_KEYS = ['freeReally', 'yearly', 'project', 'downgrade'] as const;

export const Pricing = () => {
  const { t, locale } = useMarketingT();
  const href = (path: string) => localeHref(path, locale);
  const [period, setPeriod] = useState<BillingPeriod>('monthly');

  const tiers: Tier[] = [
    {
      name: t('pricing.tiers.free.name'),
      price: { monthly: PLAN_FACTS.freePrice, yearly: PLAN_FACTS.freePrice },
      cadence: {
        monthly: t('pricing.tiers.free.cadence'),
        yearly: t('pricing.tiers.free.cadence'),
      },
      tagline: t('pricing.tiers.free.tagline'),
      features: [
        t('pricing.tiers.free.features.projects', PLAN_FACTS),
        t('pricing.tiers.free.features.retention', PLAN_FACTS),
        t('pricing.tiers.free.features.daily'),
        t('pricing.tiers.free.features.community'),
        t('pricing.tiers.free.features.selfHost'),
        t('pricing.tiers.free.features.restic'),
      ],
      cta: { label: t('shared.startFree'), to: '/register' },
    },
    {
      name: t('pricing.tiers.pro.name'),
      popular: true,
      price: { monthly: PLAN_FACTS.proMonthly, yearly: PLAN_FACTS.proYearly },
      cadence: {
        monthly: t('pricing.tiers.pro.cadenceMonthly'),
        yearly: t('pricing.tiers.pro.cadenceYearly'),
      },
      yearly: t('pricing.tiers.pro.yearlyNote', PLAN_FACTS),
      tagline: t('pricing.tiers.pro.tagline'),
      features: [
        t('pricing.tiers.pro.features.projects', PLAN_FACTS),
        t('pricing.tiers.pro.features.retention', PLAN_FACTS),
        t('pricing.tiers.pro.features.continuous'),
        t('pricing.tiers.pro.features.pitr'),
        t('pricing.tiers.pro.features.schedules'),
        t('pricing.tiers.pro.features.alerts'),
        t('pricing.tiers.pro.features.drills'),
      ],
      cta: { label: t('pricing.tiers.pro.cta'), to: '/billing?tab=plans' },
    },
    {
      name: t('pricing.tiers.business.name'),
      price: { monthly: PLAN_FACTS.bizMonthly, yearly: PLAN_FACTS.bizYearly },
      cadence: {
        monthly: t('pricing.tiers.business.cadenceMonthly'),
        yearly: t('pricing.tiers.business.cadenceYearly'),
      },
      yearly: t('pricing.tiers.business.yearlyNote', PLAN_FACTS),
      tagline: t('pricing.tiers.business.tagline'),
      features: [
        t('pricing.tiers.business.features.projects'),
        t('pricing.tiers.business.features.retention', PLAN_FACTS),
        t('pricing.tiers.business.features.cron'),
        t('pricing.tiers.business.features.mirror'),
        t('pricing.tiers.business.features.priority'),
        t('pricing.tiers.business.features.fleet'),
        t('pricing.tiers.business.features.metering'),
      ],
      cta: { label: t('pricing.tiers.business.cta'), to: '/billing?tab=plans' },
    },
  ];

  const pricingFaq: FaqItem[] = PRICING_FAQ_KEYS.map((key) => ({
    question: t(`pricing.faq.${key}.question`),
    answer: t(`pricing.faq.${key}.answer`, PLAN_FACTS),
  }));

  const periods: { value: BillingPeriod; label: string }[] = [
    { value: 'monthly', label: t('pricing.billing.monthly') },
    { value: 'yearly', label: t('pricing.billing.yearly') },
  ];

  const jsonLd = schema.graph(
    ...schema.siteEntities(),
    schema.softwareApplication([
      { name: 'Free', price: '0' },
      { name: 'Pro', price: '9' },
      { name: 'Business', price: '29' },
    ]),
    schema.breadcrumbList([
      { name: t('shared.home'), path: localeHref('/', locale) },
      { name: t('pricing.breadcrumb'), path: localeHref('/pricing', locale) },
    ]),
    schema.faqPage(pricingFaq),
  );

  return (
    <>
      <Seo
        title={t('pricing.seo.title')}
        description={t('pricing.seo.description')}
        basePath="/pricing"
        locale={locale}
        jsonLd={jsonLd}
      />

      <Container>
        <Breadcrumbs
          crumbs={[
            { label: t('shared.home'), basePath: '/' },
            { label: t('pricing.breadcrumb') },
          ]}
          locale={locale}
        />
      </Container>

      <section className={sectionClass}>
        <Container>
          <Eyebrow>{t('pricing.eyebrow')}</Eyebrow>
          <h1 className={h1Class}>{t('pricing.title')}</h1>
          <p className={answerClass}>{t('pricing.answer', PLAN_FACTS)}</p>
        </Container>
      </section>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <div className="mb-8 text-center">
            <div
              role="radiogroup"
              aria-label={t('pricing.billing.label')}
              className="inline-flex rounded-lg border bg-muted/50 p-0.5"
            >
              {periods.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={period === option.value}
                  onClick={() => setPeriod(option.value)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    period === option.value
                      ? 'bg-background shadow-xs'
                      : 'text-muted-foreground',
                  )}
                >
                  {option.label}
                  {option.value === 'yearly' && (
                    <Badge variant="outline" className="ms-1.5 text-xs">
                      {t('pricing.billing.badge')}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {tiers.map((tier, i) => (
              <Reveal
                key={tier.name}
                className={cn(
                  cardClass,
                  'flex flex-col',
                  tier.popular && 'border-primary ring-1 ring-primary',
                )}
                index={i}
              >
                {tier.popular && (
                  <Badge className="mb-2 self-start">{t('pricing.mostPopular')}</Badge>
                )}
                <h3 className="text-lg font-semibold tracking-tight">
                  {tier.name}
                </h3>
                <p className="mt-1">
                  <strong className="text-3xl font-bold tracking-tight">
                    {tier.price[period]}
                  </strong>{' '}
                  <span className="text-muted-foreground">
                    {tier.cadence[period]}
                  </span>
                </p>
                {tier.yearly ? (
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {tier.yearly}
                  </p>
                ) : null}
                <p className="mt-2 text-muted-foreground">{tier.tagline}</p>
                <ul className="my-4 space-y-2 text-sm">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <CheckIcon
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className="mt-auto w-full"
                  variant={tier.popular ? 'default' : 'outline'}
                >
                  <Link
                    to={
                      tier.cta.to === '/register'
                        ? tier.cta.to
                        : href(tier.cta.to)
                    }
                  >
                    {tier.cta.label}
                  </Link>
                </Button>
              </Reveal>
            ))}
          </div>
          <p className="mt-5 text-muted-foreground">
            {t('pricing.footnote')}
          </p>
        </Container>
      </Reveal>

      <FaqSection faqs={pricingFaq} />
    </>
  );
};
