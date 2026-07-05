import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/shared/lib/utils';

/**
 * SPEC-06 shared status chip. Used by every table + detail view (backup run,
 * snapshot verify, agent health, subscription, invite, webhook delivery,
 * audit severity).
 *
 * Anatomy: `rounded-full` pill (SPEC-A3), soft-tint fill via SPEC-A2 recipe
 * (background = token/10, text = token). Always token + LOCALIZED text —
 * never color alone (a11y).
 */
const statusChipVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      tone: {
        success: 'bg-success/10 text-success',
        warning: 'bg-warning/15 text-warning',
        destructive: 'bg-destructive/10 text-destructive',
        muted: 'bg-muted text-muted-foreground',
      },
    },
    defaultVariants: {
      tone: 'muted',
    },
  },
);

export type StatusTone = NonNullable<VariantProps<typeof statusChipVariants>['tone']>;

const StatusChip = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof statusChipVariants>
>(function StatusChip({ className, tone, children, ...props }, ref) {
  return (
    <span
      ref={ref}
      data-slot="status-chip"
      data-tone={tone ?? 'muted'}
      className={cn(statusChipVariants({ tone, className }))}
      {...props}
    >
      {children}
    </span>
  );
});

export { StatusChip, statusChipVariants };
