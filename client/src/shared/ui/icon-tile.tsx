import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/shared/lib/utils';

/**
 * SPEC-08 shared icon tile — lucide icon centered in a rounded tinted square.
 * Uses the SPEC-A2 tint recipe (background = token/10, foreground = token).
 * Compose with any lucide `*Icon` as children; never emoji.
 */
const iconTileVariants = cva(
  'inline-flex items-center justify-center rounded-lg [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      tone: {
        primary: 'bg-primary/10 text-primary',
        success: 'bg-success/10 text-success',
        warning: 'bg-warning/15 text-warning',
        destructive: 'bg-destructive/10 text-destructive',
        muted: 'bg-muted text-muted-foreground',
      },
      size: {
        sm: 'size-8 [&_svg]:size-4',
        default: 'size-10',
        lg: 'size-12 [&_svg]:size-6',
      },
    },
    defaultVariants: {
      tone: 'muted',
      size: 'default',
    },
  },
);

const IconTile = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof iconTileVariants>
>(function IconTile({ className, tone, size, children, ...props }, ref) {
  return (
    <span
      ref={ref}
      data-slot="icon-tile"
      data-tone={tone ?? 'muted'}
      aria-hidden="true"
      className={cn(iconTileVariants({ tone, size, className }))}
      {...props}
    >
      {children}
    </span>
  );
});

export { IconTile, iconTileVariants };
