import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/shared/lib/utils';

/**
 * SPEC-05A soft-tint stat chip: compact rollup cell with value + label +
 * end-aligned icon in a full-strength-token circle.
 *
 * Tone maps to the SPEC-A1 status vocabulary — pick by the metric's
 * semantic (succeeded=success / pending=warning / failed=destructive /
 * neutral=muted). Static — no hover lift, no animated counters.
 */
const statChipVariants = cva('rounded-xl px-4 py-4', {
  variants: {
    tone: {
      success: 'bg-success/10',
      warning: 'bg-warning/15',
      destructive: 'bg-destructive/10',
      muted: 'bg-muted',
    },
  },
  defaultVariants: {
    tone: 'muted',
  },
});

const chipIconWrapper = cva(
  'inline-flex size-8 items-center justify-center rounded-full [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      tone: {
        success: 'bg-success text-success-foreground',
        warning: 'bg-warning text-warning-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        muted: 'bg-muted-foreground/20 text-foreground',
      },
    },
    defaultVariants: { tone: 'muted' },
  },
);

export interface StatChipProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statChipVariants> {
  value: React.ReactNode;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

const StatChip = React.forwardRef<HTMLDivElement, StatChipProps>(function StatChip(
  { className, tone, value, label, icon, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-slot="stat-chip"
      data-tone={tone ?? 'muted'}
      className={cn(statChipVariants({ tone, className }))}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
        {icon ? (
          <span aria-hidden="true" className={chipIconWrapper({ tone })}>
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
});

export { StatChip, statChipVariants };
