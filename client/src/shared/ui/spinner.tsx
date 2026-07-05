import * as React from 'react';
import { Loader2Icon } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

/**
 * Shared in-place loading indicator (interaction-hygiene rule).
 * Composed by `Button loading` and long-running dialogs.
 *
 * A11y: default `aria-label="Loading"`, `role="status"` — screen readers
 * announce it; overridable via props for translated labels.
 */
const Spinner = React.forwardRef<
  SVGSVGElement,
  React.SVGAttributes<SVGSVGElement>
>(function Spinner({ className, 'aria-label': ariaLabel, ...props }, ref) {
  return (
    <Loader2Icon
      ref={ref}
      role="status"
      aria-label={ariaLabel ?? 'Loading'}
      data-slot="spinner"
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  );
});

export { Spinner };
