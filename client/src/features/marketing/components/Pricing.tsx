import { Link } from 'react-router-dom';
import { Seo, schema } from '@shared/seo';
import { Button } from '@shared/ui/button';
import { cn } from '@shared/lib/utils';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import {
  Breadcrumbs,
  Container,
  Eyebrow,
  FaqSection,
  cardClass,
  h1Class,
  sectionClass,
} from './shared';
import { Reveal } from '../useReveal';
import type { FaqItem } from '../types';

const ANSWER =
  'Dockstash has three plans. Free ($0) self-hosts one project with 7-day retention and daily backups. Pro ($9/mo) adds 10 projects, 30-day retention, hourly schedules, and email alerts. Business ($29/mo) is unlimited projects, 90-day retention, any cron, priority support, and multi-VPS. Yearly billing gives you two months free — $90/yr for Pro and $290/yr for Business.';

interface Tier {
  name: string;
  price: string;
  cadence: string;
  yearly?: string;
  tagline: string;
  features: string[];
  cta: { label: string; to: string; primary?: boolean };
}

const TIERS: Tier[] = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    tagline: 'Self-host one project, entirely on your own storage.',
    features: [
      '1 project',
      '7-day retention',
      'Daily backups',
      'Community support',
      'Self-host default — no paid provider',
      'Standard Restic repos on your storage VPS',
    ],
    cta: { label: 'Start free', to: '/register', primary: true },
  },
  {
    name: 'Pro',
    price: '$9',
    cadence: 'per month',
    yearly: 'or $90/yr — two months free',
    tagline: 'For teams running Docker Compose in production.',
    features: [
      '10 projects',
      '30-day retention',
      'Hourly backups',
      'Custom schedules',
      'Email alerts + dead-man’s-switch heartbeat',
      'Automated restore-drill verification',
    ],
    cta: { label: 'Choose Pro', to: '/checkout/pro' },
  },
  {
    name: 'Business',
    price: '$29',
    cadence: 'per month',
    yearly: 'or $290/yr — two months free',
    tagline: 'For agencies managing many client servers.',
    features: [
      'Unlimited projects',
      '90-day retention',
      'Any cron schedule',
      'Priority support',
      'Multi-VPS fleet view',
      'Per-project metering',
    ],
    cta: { label: 'Choose Business', to: '/checkout/business' },
  },
];

const PRICING_FAQ: FaqItem[] = [
  {
    question: 'Is the Free plan really free?',
    answer:
      'Yes. The Free tier runs entirely self-hosted with no paid provider and no credit card. It backs up one project daily with 7-day retention to your own storage VPS as standard encrypted Restic repositories.',
  },
  {
    question: 'How does yearly billing work?',
    answer:
      'Pay yearly on Pro or Business and you get two months free — you pay for ten months and use twelve. You can switch between monthly and yearly at any time from the billing page.',
  },
  {
    question: 'What counts as a project?',
    answer:
      'A project is one Docker Compose stack Dockstash backs up (its volumes, databases, and config). Free covers one, Pro covers ten, and Business is unlimited across as many VPS agents as you run.',
  },
  {
    question: 'What happens to my backups if I downgrade or cancel?',
    answer:
      'Your backups stay on your own storage VPS as standard Restic repositories you can restore from with the restic CLI alone. There is no vendor lock-in and no data held hostage behind a paywall.',
  },
];

export const Pricing = () => {
  const { locale } = useMarketingRoute();
  const href = (path: string) => localeHref(path, locale);

  const jsonLd = schema.graph(
    schema.softwareApplication([
      { name: 'Free', price: '0' },
      { name: 'Pro', price: '9' },
      { name: 'Business', price: '29' },
    ]),
    schema.breadcrumbList([
      { name: 'Home', path: localeHref('/', locale) },
      { name: 'Pricing', path: localeHref('/pricing', locale) },
    ]),
    schema.faqPage(PRICING_FAQ),
  );

  return (
    <>
      <Seo
        title="Pricing — free self-host, Pro, and Business"
        description="Dockstash pricing: a free self-hosted tier for one project, Pro for teams (10 projects, hourly backups, alerts), and Business for agencies (unlimited, multi-VPS). Two months free yearly."
        basePath="/pricing"
        locale={locale}
        jsonLd={jsonLd}
      />

      <Container>
        <Breadcrumbs
          crumbs={[{ label: 'Home', basePath: '/' }, { label: 'Pricing' }]}
          locale={locale}
        />
      </Container>

      <section className={sectionClass}>
        <Container>
          <Eyebrow>Pricing</Eyebrow>
          <h1 className={h1Class}>Simple pricing for verified Docker backups</h1>
          <p className="max-w-[720px] rounded-lg border border-border bg-muted p-5 text-lg leading-relaxed">
            {ANSWER}
          </p>
        </Container>
      </section>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <div className="grid gap-5 lg:grid-cols-3">
            {TIERS.map((tier, i) => (
              <Reveal
                key={tier.name}
                className={cn(
                  cardClass,
                  'flex flex-col',
                  tier.cta.primary && 'border-primary ring-1 ring-primary/40',
                )}
                index={i}
              >
                <h3 className="text-lg font-semibold tracking-tight">
                  {tier.name}
                </h3>
                <p className="mt-1">
                  <strong className="text-3xl font-bold tracking-tight">
                    {tier.price}
                  </strong>{' '}
                  <span className="text-muted-foreground">{tier.cadence}</span>
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
                      <span aria-hidden="true" className="text-primary">
                        ✓
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className="mt-auto w-full"
                  variant={tier.cta.primary ? 'default' : 'outline'}
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
            Yearly billing on Pro and Business gives you two months free.
          </p>
        </Container>
      </Reveal>

      <FaqSection faqs={PRICING_FAQ} />
    </>
  );
};
