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
  h2Class,
  sectionClass,
} from './shared';
import { Reveal } from '../useReveal';
import type { FaqItem } from '../types';

const ANSWER =
  'Dockstash is built to hold your most sensitive credentials safely. Secrets are encrypted at rest with AES-256-GCM, the SSH backup channel pins the storage host key, and every Restic repository is encrypted with your own key. Destructive restores require a typed confirmation, and restore drills prove your data recovers.';

const CARDS = [
  {
    title: 'AES-256-GCM secrets at rest',
    body: 'Your Restic password and SSH keys are never stored in plaintext. They are encrypted at rest with an AES-256-GCM master key, with recovery-code escrow for key rotation.',
  },
  {
    title: 'SSH host-key pinning',
    body: 'The backup channel to your storage VPS pins the host key, so a man-in-the-middle cannot silently intercept or redirect your encrypted snapshots.',
  },
  {
    title: 'Encrypted Restic repositories',
    body: 'Every repository is a standard Restic repo encrypted with your key. Data is encrypted and deduplicated before it ever leaves your production VPS.',
  },
  {
    title: 'Typed-confirm destructive restore',
    body: 'A restore that overwrites live data requires you to type the project name to confirm. The default is restore-to-new-location, with database staging before any overwrite.',
  },
  {
    title: 'Restore-drill verification',
    body: 'Dockstash restores the latest snapshot to a scratch location and diffs it against the source on a schedule, so you find out a backup is broken before you need it.',
  },
  {
    title: 'Your storage, no lock-in',
    body: 'Backups live on your own storage VPS as standard Restic repos. If you ever leave, restore with the restic CLI alone — Dockstash adds no proprietary layer.',
  },
];

const SECURITY_FAQ: FaqItem[] = [
  {
    question: 'Where are my SSH key and Restic password stored?',
    answer:
      'Encrypted at rest with AES-256-GCM using a master key, never in plaintext. On the self-hosted tier they live on your own server. Recovery-code escrow lets you rotate the master key without losing access.',
  },
  {
    question: 'Does Dockstash ever hold my backup data?',
    answer:
      'No. On the Free/self-host tier the entire pipeline runs on your infrastructure and backups land on your storage VPS. Dockstash orchestrates the backup; it never stores your data on our servers.',
  },
  {
    question: 'How does Dockstash prevent an accidental destructive restore?',
    answer:
      'Restores default to a new location, databases are staged before any overwrite, and a restore that would overwrite live data requires you to type the project name to confirm. There is no one-click way to clobber production.',
  },
  {
    question: 'What happens to my encrypted backups if Dockstash disappears?',
    answer:
      'They stay on your storage VPS as standard, encrypted Restic repositories. Point the restic CLI at the repo with your key and restore with no vendor involved. There is zero lock-in.',
  },
];

export const Security = () => {
  const { locale } = useMarketingRoute();
  const href = (path: string) => localeHref(path, locale);

  const jsonLd = schema.graph(
    schema.breadcrumbList([
      { name: 'Home', path: localeHref('/', locale) },
      { name: 'Security', path: localeHref('/security', locale) },
    ]),
    schema.faqPage(SECURITY_FAQ),
  );

  return (
    <>
      <Seo
        title="Security — how Dockstash protects your data"
        description="How Dockstash secures backups: AES-256-GCM secrets at rest, SSH host-key pinning, encrypted Restic repositories, typed-confirm restores, restore-drill verification, and no lock-in."
        basePath="/security"
        locale={locale}
        jsonLd={jsonLd}
      />

      <Container>
        <Breadcrumbs
          crumbs={[{ label: 'Home', basePath: '/' }, { label: 'Security' }]}
          locale={locale}
        />
      </Container>

      <section className={sectionClass}>
        <Container>
          <Eyebrow>Security</Eyebrow>
          <h1 className={h1Class}>Security you can verify</h1>
          <p className="max-w-[720px] rounded-lg border border-border bg-muted p-5 text-lg leading-relaxed">
            {ANSWER}
          </p>
        </Container>
      </section>

      <Reveal as="section" className={sectionClass}>
        <Container>
          <h2 className={h2Class}>How your data stays safe</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CARDS.map((card, i) => (
              <Reveal key={card.title} className={cn(cardClass, 'space-y-2')} index={i}>
                <h3 className="text-lg font-semibold tracking-tight">
                  {card.title}
                </h3>
                <p className="text-muted-foreground">{card.body}</p>
              </Reveal>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/register">Start free</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={href('/faq')}>Read the FAQ</Link>
            </Button>
          </div>
        </Container>
      </Reveal>

      <FaqSection faqs={SECURITY_FAQ} />
    </>
  );
};
