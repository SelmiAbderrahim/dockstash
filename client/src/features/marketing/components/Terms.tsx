import { Link } from 'react-router-dom';
import { Seo, schema } from '@shared/seo';
import type { SupportedLocale } from '@shared/i18n';
import { useMarketingRoute, localeHref } from '../useMarketingRoute';
import {
  Breadcrumbs,
  Container,
  Eyebrow,
  LastUpdated,
  LegalSections,
  answerClass,
  h1Class,
  sectionClass,
  type LegalSectionDef,
} from './shared';

const ANSWER =
  'These terms govern your use of Dockstash, the backup orchestration service for Docker projects. In short: you own your data and your backups, they live on your own storage, you are responsible for your keys and for verifying restores, billing is handled by Polar and can be cancelled any time, and deleting your account purges your data after a 30-day grace period.';

const sections = (locale: SupportedLocale): LegalSectionDef[] => [
  {
    id: 'acceptance',
    title: 'Acceptance of these terms',
    body: (
      <p>
        By creating a Dockstash account or using the service you agree to
        these Terms of Service and to our{' '}
        <Link
          to={localeHref('/privacy', locale)}
          className="text-foreground underline underline-offset-4"
        >
          Privacy Policy
        </Link>
        . If you use Dockstash on behalf of an organization, you confirm you
        have authority to bind that organization. You must be at least 16
        years old to use the service.
      </p>
    ),
  },
  {
    id: 'service',
    title: 'The service',
    body: (
      <>
        <p>
          Dockstash orchestrates verified backups for Docker projects: it
          detects your services, schedules encrypted Restic backups from your
          production server to your own storage VPS, runs scheduled restore
          drills, and alerts you when something breaks.
        </p>
        <p>Three plans are offered:</p>
        <ul>
          <li>
            <strong>Free</strong> — self-hosted on your own infrastructure,
            one project, daily backups, 7-day retention;
          </li>
          <li>
            <strong>Pro</strong> — up to 10 projects, hourly schedules,
            30-day retention, email alerts;
          </li>
          <li>
            <strong>Business</strong> — unlimited projects, any cron
            schedule, 90-day retention, multi-VPS, priority support.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'accounts',
    title: 'Your account and your keys',
    body: (
      <>
        <p>
          You are responsible for keeping your credentials confidential and
          for all activity under your account. Provide accurate account
          information and keep it current.
        </p>
        <p>
          <strong>Guard your encryption material.</strong> Your Restic
          repository passwords and SSH keys are stored by Dockstash only as
          AES-256-GCM ciphertext, and your recovery codes are the only way to
          re-establish access if the encryption key must be rotated after a
          loss. If you lose both, neither you nor Dockstash can decrypt the
          affected repositories — that is by design.
        </p>
      </>
    ),
  },
  {
    id: 'your-data',
    title: 'Your data and backups',
    body: (
      <>
        <p>
          You own your project data and your backups. Backups are written to
          your own storage VPS as standard, encrypted Restic repositories —
          Dockstash adds no proprietary format and never hosts your backup
          contents. If you stop using Dockstash, your repositories remain
          fully restorable with the open-source restic CLI alone.
        </p>
        <p>
          You grant Dockstash the limited rights needed to operate the
          service: storing your project configuration, connecting to the
          servers you registered, and executing the backup, prune, and
          restore-drill jobs you configure.
        </p>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>
            back up or access servers or data you are not authorized to
            access;
          </li>
          <li>use the service for unlawful content or activity;</li>
          <li>
            probe, disrupt, or overload the service or other users&apos;
            projects;
          </li>
          <li>
            resell or white-label the hosted service without our written
            consent;
          </li>
          <li>attempt to bypass plan limits or billing.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'billing',
    title: 'Billing, cancellation, and refunds',
    body: (
      <>
        <p>
          Paid plans are billed through <strong>Polar</strong>, our merchant
          of record, which also handles applicable taxes. Pro is $9/month or
          $90/year; Business is $29/month or $290/year. Subscriptions renew
          automatically until cancelled.
        </p>
        <p>
          You can cancel at any time from your billing settings; cancellation
          takes effect at the end of the current billing period and no
          further charges are made. We will give at least 30 days&apos; notice by
          email before any price change affects an existing subscription.
        </p>
      </>
    ),
  },
  {
    id: 'self-hosted',
    title: 'Self-hosted (Free) tier',
    body: (
      <p>
        The self-hosted tier is provided as-is, without uptime commitments or
        support obligations. You are responsible for operating, securing, and
        updating your own installation and the infrastructure it runs on.
      </p>
    ),
  },
  {
    id: 'backup-responsibility',
    title: 'Backup verification is your responsibility',
    body: (
      <>
        <p>
          Backups only matter if they restore. Dockstash gives you the tools
          to verify — scheduled restore drills, snapshot diffs, and alerts —
          but <strong>you remain responsible for confirming that your
          backups meet your recovery needs</strong>, including drill
          schedules, retention settings, and periodic test restores of the
          data you care about.
        </p>
        <p>
          Dockstash is not liable for data loss caused by misconfigured
          projects, disabled schedules, exhausted storage, lost encryption
          keys, or backups whose restorability was never verified.
        </p>
      </>
    ),
  },
  {
    id: 'intellectual-property',
    title: 'Intellectual property',
    body: (
      <p>
        Dockstash, its software, branding, and this website remain our
        property. These terms grant you no rights in them beyond using the
        service. If you send us feedback, we may use it without obligation to
        you.
      </p>
    ),
  },
  {
    id: 'third-party-services',
    title: 'Third-party services',
    body: (
      <p>
        Payments run on Polar and transactional email on Resend, each under
        its own terms. The servers and storage you connect — your VPS
        providers — are your relationship and your responsibility; Dockstash
        is not a party to those agreements.
      </p>
    ),
  },
  {
    id: 'disclaimers',
    title: 'Disclaimers and limitation of liability',
    body: (
      <>
        <p>
          The service is provided &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo;, without
          warranties of any kind, express or implied, including fitness for a
          particular purpose and non-infringement.
        </p>
        <p>
          To the maximum extent permitted by law, Dockstash is not liable for
          indirect, incidental, special, or consequential damages, or for
          lost profits, revenue, or data. Our total aggregate liability for
          any claim is limited to the amount you paid us in the 12 months
          before the claim arose. Nothing in these terms excludes liability
          that cannot be excluded by law.
        </p>
      </>
    ),
  },
  {
    id: 'indemnification',
    title: 'Indemnification',
    body: (
      <p>
        You will indemnify and hold Dockstash harmless from claims arising
        out of your content, your use of the service in breach of these
        terms, or your violation of law or third-party rights.
      </p>
    ),
  },
  {
    id: 'termination',
    title: 'Termination and account deletion',
    body: (
      <>
        <p>
          You may delete your account at any time from settings. Deletion
          starts a <strong>30-day grace period</strong> during which you can
          change your mind; after it ends, your account is deleted and the
          Restic repositories Dockstash manages for your projects are purged.
          Data under a legal hold is retained until the hold is released, as
          described in the Privacy Policy.
        </p>
        <p>
          We may suspend or terminate accounts that materially breach these
          terms, after notice where practical. Sections that by their nature
          should survive termination — including ownership, disclaimers,
          liability limits, and indemnification — survive.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: (
      <p>
        We may update these terms as the service evolves. For material
        changes we will email account holders at least 30 days before the new
        terms take effect; continued use after that date constitutes
        acceptance. The date above always reflects the latest revision.
      </p>
    ),
  },
  {
    id: 'governing-law',
    title: 'Governing law and disputes',
    body: (
      <p>
        These terms are governed by the laws of the jurisdiction in which
        Dockstash is established, without regard to conflict-of-law rules,
        and disputes are subject to the exclusive jurisdiction of the courts
        there — except where the consumer-protection law of your country of
        residence grants you mandatory rights and venues, which remain
        unaffected.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        Questions about these terms:{' '}
        <a
          href="mailto:legal@dockstash.com"
          className="text-foreground underline underline-offset-4"
        >
          legal@dockstash.com
        </a>
        .
      </p>
    ),
  },
];

export const Terms = () => {
  const { locale } = useMarketingRoute();

  const jsonLd = schema.graph(
    ...schema.siteEntities(),
    schema.webPage(
      'Terms of Service',
      'The terms that govern your use of Dockstash.',
      localeHref('/terms', locale),
    ),
    schema.breadcrumbList([
      { name: 'Home', path: localeHref('/', locale) },
      { name: 'Terms of Service', path: localeHref('/terms', locale) },
    ]),
  );

  return (
    <>
      <Seo
        title="Terms of Service — Dockstash"
        description="The terms that govern Dockstash: you own your data and backups, cancel-anytime billing, and a 30-day deletion grace period."
        basePath="/terms"
        locale={locale}
        localized={false}
        jsonLd={jsonLd}
      />

      <Container>
        <Breadcrumbs
          crumbs={[{ label: 'Home', basePath: '/' }, { label: 'Terms of Service' }]}
          locale={locale}
        />
      </Container>

      <section className={sectionClass}>
        <Container>
          <Eyebrow>Legal</Eyebrow>
          <h1 className={h1Class}>Terms of Service</h1>
          <p className={answerClass}>{ANSWER}</p>
          <LastUpdated iso="2026-07" />
        </Container>
      </section>

      <section className={sectionClass}>
        <Container>
          <LegalSections sections={sections(locale)} />
        </Container>
      </section>
    </>
  );
};
