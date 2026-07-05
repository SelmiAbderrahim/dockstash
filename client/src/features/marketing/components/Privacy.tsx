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
  'Dockstash stores the minimum needed to orchestrate your backups: your account details, project configuration, and secrets encrypted with AES-256-GCM. Your backup data itself never touches our servers — it lives on your own storage VPS as encrypted Restic repositories. We use no analytics or advertising cookies, and we never sell personal data.';

const sections = (locale: SupportedLocale): LegalSectionDef[] => [
  {
    id: 'overview',
    title: 'Who we are and what this policy covers',
    body: (
      <>
        <p>
          Dockstash provides one-click, verified backups for Docker projects.
          This policy explains what personal data we collect when you visit
          dockstash.com or use the Dockstash service, why we collect it, and
          the rights you have over it. Dockstash is the data controller for
          the personal data described here.
        </p>
        <p>
          On the Free / self-hosted tier the entire pipeline runs on your own
          infrastructure. In that case we receive no personal data from your
          installation at all, and this policy applies only to your use of
          this website and any hosted account you create.
        </p>
      </>
    ),
  },
  {
    id: 'data-we-collect',
    title: 'Data we collect',
    body: (
      <>
        <p>We collect only what the service needs to function:</p>
        <ul>
          <li>
            <strong>Account data</strong> — your email address, display name,
            password (stored only as a bcrypt hash), language preference, and
            account timestamps.
          </li>
          <li>
            <strong>Project configuration</strong> — project names, the
            connection details of the servers you back up, container and
            service metadata, and backup schedules you define.
          </li>
          <li>
            <strong>Encrypted secrets</strong> — the SSH keys and Restic
            repository passwords you provide are stored exclusively as
            AES-256-GCM ciphertext. They are never stored or logged in
            plaintext.
          </li>
          <li>
            <strong>Billing data</strong> — payments are processed by Polar,
            our merchant of record. We store your subscription tier and
            status; we never see or store your card number.
          </li>
          <li>
            <strong>Operational records</strong> — backup job outcomes,
            restore-drill results, audit events, and the alert emails we send
            you, so you can see what happened and when.
          </li>
          <li>
            <strong>Support communications</strong> — messages you send us,
            so we can reply.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'data-we-do-not-collect',
    title: 'Data we do not collect',
    body: (
      <>
        <p>
          <strong>Your backup contents never touch our servers.</strong>{' '}
          Backups are encrypted and deduplicated on your production server and
          land on your own storage VPS as standard, encrypted Restic
          repositories. Dockstash orchestrates the backup; it does not host,
          read, or copy the data inside it.
        </p>
        <p>
          We also run no third-party analytics, no advertising trackers, and
          no social-media pixels on this site.
        </p>
      </>
    ),
  },
  {
    id: 'how-we-use-data',
    title: 'How we use your data',
    body: (
      <>
        <p>We use the data above to:</p>
        <ul>
          <li>operate your account and run the backup schedules you define;</li>
          <li>
            send transactional email via Resend — verification links, backup
            and restore-drill alerts, billing notices, and account-deletion
            warnings;
          </li>
          <li>process subscriptions and payments through Polar;</li>
          <li>secure the service, prevent abuse, and debug failures;</li>
          <li>comply with legal obligations.</li>
        </ul>
        <p>
          We do not sell personal data, use it for advertising, or share it
          with data brokers.
        </p>
      </>
    ),
  },
  {
    id: 'legal-bases',
    title: 'Legal bases (GDPR)',
    body: (
      <>
        <p>Where the GDPR applies, we rely on:</p>
        <ul>
          <li>
            <strong>Contract</strong> — account, project, billing, and
            operational data are processed to deliver the service you signed
            up for;
          </li>
          <li>
            <strong>Legitimate interest</strong> — securing the service,
            preventing abuse, and keeping audit records;
          </li>
          <li>
            <strong>Legal obligation</strong> — retaining billing records
            where tax or accounting law requires it;
          </li>
          <li>
            <strong>Consent</strong> — anything optional we may add later,
            which you can withdraw at any time.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'sharing',
    title: 'Who we share data with',
    body: (
      <>
        <p>
          We share personal data only with the processors needed to run the
          service, under data-processing agreements:
        </p>
        <ul>
          <li>
            <strong>Polar</strong> — payment processing and tax handling as
            merchant of record;
          </li>
          <li>
            <strong>Resend</strong> — delivery of transactional email;
          </li>
          <li>
            <strong>Our hosting provider</strong> — the infrastructure the
            hosted control plane runs on.
          </li>
        </ul>
        <p>
          Beyond that, we disclose data only if the law requires it. We do not
          sell personal data and have not done so in the preceding 12 months
          (a disclosure the CCPA requires us to make).
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies',
    body: (
      <>
        <p>Dockstash sets only strictly necessary cookies:</p>
        <ul>
          <li>
            <strong>token</strong> — keeps you signed in to your account;
          </li>
          <li>
            <strong>lang</strong> — remembers your language choice.
          </li>
        </ul>
        <p>
          There are no analytics, advertising, or cross-site tracking cookies,
          which is why you see no cookie-consent banner.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'Data retention and deletion',
    body: (
      <>
        <p>
          We keep account and project data for as long as your account is
          active. When you request account deletion, a{' '}
          <strong>30-day grace period</strong> starts during which you can
          cancel the request; we warn you by email when the purge is 24 hours
          away. At the end of the grace period your account is deleted and the
          Restic repositories Dockstash manages for your projects are purged
          from your storage.
        </p>
        <p>
          Two exceptions: billing records are retained as long as tax and
          accounting law requires, and data under a legal hold is retained
          until the hold is released.
        </p>
      </>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    body: (
      <>
        <p>Wherever you live, you can exercise these rights from within the app or by emailing us:</p>
        <ul>
          <li>
            <strong>Access and portability</strong> — export a machine-readable
            JSON copy of your account, projects, and plans from your account
            settings. Encrypted secrets are exported as ciphertext only.
          </li>
          <li>
            <strong>Rectification</strong> — correct your account details in
            settings at any time.
          </li>
          <li>
            <strong>Erasure</strong> — delete your account (see the retention
            section above for the grace period and purge).
          </li>
          <li>
            <strong>Objection and restriction</strong> — contact us to object
            to or restrict any processing based on legitimate interest.
          </li>
        </ul>
        <p>
          If you are in the EU/EEA or UK you may also lodge a complaint with
          your supervisory authority. California residents have the right to
          know, access, and delete personal information, to opt out of its
          sale (we sell none), and to not be discriminated against for
          exercising those rights.
        </p>
      </>
    ),
  },
  {
    id: 'privacy-security',
    title: 'How we protect your data',
    body: (
      <>
        <p>
          Secrets are encrypted at rest with AES-256-GCM, the SSH backup
          channel pins your storage host key, every Restic repository is
          encrypted with your key, and destructive restores require typed
          confirmation. The full picture is on our{' '}
          <Link
            to={localeHref('/security', locale)}
            className="text-foreground underline underline-offset-4"
          >
            security page
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    id: 'international-transfers',
    title: 'International transfers',
    body: (
      <>
        <p>
          Your backup data stays wherever your storage VPS is — you choose the
          location. Control-plane data is processed where our infrastructure
          and processors operate; where that involves transfers out of the
          EU/EEA, our processors rely on Standard Contractual Clauses or an
          adequacy decision. The Business tier additionally offers a
          region-of-choice option for the control plane.
        </p>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: (
      <p>
        Dockstash is not directed at children and we do not knowingly collect
        personal data from anyone under 16. If you believe a child has created
        an account, contact us and we will delete it.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        We will post any changes on this page and update the date above. For
        material changes we will email every account holder before the change
        takes effect.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        Questions or requests about this policy:{' '}
        <a
          href="mailto:privacy@dockstash.com"
          className="text-foreground underline underline-offset-4"
        >
          privacy@dockstash.com
        </a>
        .
      </p>
    ),
  },
];

export const Privacy = () => {
  const { locale } = useMarketingRoute();

  const jsonLd = schema.graph(
    ...schema.siteEntities(),
    schema.webPage(
      'Privacy Policy',
      'How Dockstash collects, uses, and protects your data.',
      localeHref('/privacy', locale),
    ),
    schema.breadcrumbList([
      { name: 'Home', path: localeHref('/', locale) },
      { name: 'Privacy Policy', path: localeHref('/privacy', locale) },
    ]),
  );

  return (
    <>
      <Seo
        title="Privacy Policy — Dockstash"
        description="What Dockstash collects and why: account and project configuration only, secrets encrypted with AES-256-GCM, backups on your own storage, no analytics cookies, and no data sales."
        basePath="/privacy"
        locale={locale}
        localized={false}
        jsonLd={jsonLd}
      />

      <Container>
        <Breadcrumbs
          crumbs={[{ label: 'Home', basePath: '/' }, { label: 'Privacy Policy' }]}
          locale={locale}
        />
      </Container>

      <section className={sectionClass}>
        <Container>
          <Eyebrow>Legal</Eyebrow>
          <h1 className={h1Class}>Privacy Policy</h1>
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
