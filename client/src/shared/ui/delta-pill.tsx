import * as React from 'react';

import { cn } from '@/shared/lib/utils';

/**
 * SPEC-09 delta pill for KPI cards.
 *
 * `value` is the numeric delta; `invert` flips semantic goodness — for
 * storage-cost / failure-count metrics a *decrease* is good, so pass
 * `invert` so the pill colors by GOODNESS, not by sign.
 *
 * Rendered text is always prefixed with an explicit +/- sign; caller
 * formats the number itself (Intl.NumberFormat / percent / bytes) so RTL
 * digit shaping stays consistent with the rest of the surface.
 */
export interface DeltaPillProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** The numeric delta. Sign controls the default tone. */
  value: number;
  /** How the value should be rendered inside the pill (pre-formatted). */
  formatted: string;
  /** Flip semantic goodness — decreases are good (e.g. cost, failures). */
  invert?: boolean;
}

const toneClass = (goodness: 'good' | 'bad' | 'neutral'): string => {
  if (goodness === 'good') return 'bg-success/10 text-success';
  if (goodness === 'bad') return 'bg-destructive/10 text-destructive';
  return 'bg-muted text-muted-foreground';
};

const DeltaPill = React.forwardRef<HTMLSpanElement, DeltaPillProps>(
  function DeltaPill({ className, value, formatted, invert = false, ...props }, ref) {
    const goodness: 'good' | 'bad' | 'neutral' =
      value === 0 ? 'neutral' : (value > 0) !== invert ? 'good' : 'bad';
    const sign = value > 0 ? '+' : value < 0 ? '−' : '±';
    return (
      <span
        ref={ref}
        data-slot="delta-pill"
        data-goodness={goodness}
        className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
          toneClass(goodness),
          className,
        )}
        {...props}
      >
        <span aria-hidden="true">{sign}</span>
        <span className="ms-0.5">{formatted}</span>
      </span>
    );
  },
);

export { DeltaPill };
