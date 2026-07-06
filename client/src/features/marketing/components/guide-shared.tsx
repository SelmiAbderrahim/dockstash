// Shared building blocks for the guide articles (service + platform).
// Visual language: design-system Steps anatomy — oversized serif italic
// numerals, hairline divider, title + muted body. RTL-safe logical
// utilities only; commands render in the LTR CodeBlock.

import { Skeleton } from '@shared/ui/skeleton';
import type { GuideStep } from '../types';
import type { GuideStepCopy, TroubleshootingItem } from '../content';
import { CodeBlock, Container, sectionClass } from './shared';

/** Ordered walkthrough: numbered steps, optional command per step. */
export const WalkthroughList = ({
  steps,
  copy,
}: {
  steps: GuideStep[];
  copy: Record<string, GuideStepCopy>;
}) => (
  <ol className="space-y-10">
    {steps.map((step, index) => {
      const stepCopy = copy[step.id];
      /* v8 ignore next -- guide-copy tests guarantee copy for every shipped step id */
      if (!stepCopy) return null;
      return (
        <li key={step.id} className="grid gap-4 sm:grid-cols-[72px_1fr]">
          <span
            aria-hidden="true"
            className="font-serif text-4xl italic leading-none text-muted-foreground/40"
          >
            {String(index + 1).padStart(2, '0')}
          </span>
          <div>
            <div className="mb-3 h-px w-10 bg-border" aria-hidden="true" />
            <h3 className="text-base font-semibold tracking-tight">
              {stepCopy.title}
            </h3>
            <p className="mt-2 max-w-prose text-muted-foreground">
              {stepCopy.body}
            </p>
            {step.cmd && (
              <div className="mt-4">
                <CodeBlock>{step.cmd}</CodeBlock>
              </div>
            )}
          </div>
        </li>
      );
    })}
  </ol>
);

/** Symptom / cause / fix rows as flat bordered cards. */
export const TroubleshootingList = ({
  items,
  labels,
}: {
  items: TroubleshootingItem[];
  labels: { symptom: string; cause: string; fix: string };
}) => (
  <div className="space-y-5">
    {items.map((item) => (
      <div
        key={item.symptom}
        className="rounded-xl border bg-card p-5 text-card-foreground shadow-xs"
      >
        <dl className="space-y-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {labels.symptom}
            </dt>
            <dd className="mt-1 font-medium">{item.symptom}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {labels.cause}
            </dt>
            <dd className="mt-1 max-w-prose text-muted-foreground">{item.cause}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {labels.fix}
            </dt>
            <dd className="mt-1 max-w-prose text-muted-foreground">{item.fix}</dd>
          </div>
        </dl>
      </div>
    ))}
  </div>
);

/**
 * Transient client-only state: shown on a cold CSR entry into a guide URL
 * while the locale's copy bundle chunk loads. SSR and hydration never render
 * this (the entries preload the bundle).
 */
export const GuideLoading = ({ label }: { label: string }) => (
  <section className={sectionClass} aria-busy="true" aria-live="polite">
    <Container>
      <span className="sr-only">{label}</span>
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="mt-6 h-24 w-full" />
      <Skeleton className="mt-6 h-24 w-full" />
    </Container>
  </section>
);
