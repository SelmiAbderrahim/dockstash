import { Link } from 'react-router-dom';
import { Seo, schema } from '@shared/seo';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import { Breadcrumbs, FaqSection } from './shared';
import type { FaqItem } from '../types';

const ANSWER =
  'Dockstash has three plans. Free ($0) self-hosts one project with 7-day retention and daily backups. Pro adds 10 projects, 30-day retention, hourly schedules, and email alerts. Business is unlimited projects, 90-day retention, any cron, priority support, and multi-VPS. Yearly billing gives you two months free.';

interface Tier {
  name: string;
  price: string;
  cadence: string;
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
    price: '$X',
    cadence: 'per month',
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
    price: '$Y',
    cadence: 'per month',
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
    schema.softwareApplication([{ name: 'Free', price: '0' }]),
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

      <div className="mk-container">
        <Breadcrumbs
          crumbs={[{ label: 'Home', basePath: '/' }, { label: 'Pricing' }]}
          locale={locale}
        />
      </div>

      <section className="mk-section">
        <div className="mk-container">
          <h1 className="mk-h1">Simple pricing for verified Docker backups</h1>
          <p className="mk-answer">{ANSWER}</p>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-grid">
            {TIERS.map((tier) => (
              <div key={tier.name} className="mk-card">
                <h3>{tier.name}</h3>
                <p style={{ margin: '0 0 4px' }}>
                  <strong style={{ fontSize: 28 }}>{tier.price}</strong>{' '}
                  <span className="mk-muted">{tier.cadence}</span>
                </p>
                <p className="mk-muted">{tier.tagline}</p>
                <ul>
                  {tier.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <p style={{ marginTop: 16 }}>
                  <Link
                    to={
                      tier.cta.to === '/register'
                        ? tier.cta.to
                        : href(tier.cta.to)
                    }
                    className={
                      tier.cta.primary
                        ? 'mk-btn mk-btn--primary'
                        : 'mk-btn'
                    }
                  >
                    {tier.cta.label}
                  </Link>
                </p>
              </div>
            ))}
          </div>
          <p className="mk-muted" style={{ marginTop: 20 }}>
            Yearly billing on Pro and Business gives you two months free.
          </p>
        </div>
      </section>

      <FaqSection faqs={PRICING_FAQ} />
    </>
  );
};
