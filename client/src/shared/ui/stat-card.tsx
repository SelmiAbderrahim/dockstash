import * as React from 'react';

import { cn } from '@/shared/lib/utils';
import { Card, CardContent } from './card';
import { IconTile } from './icon-tile';

/**
 * SPEC-05B/C shared stat card. Absorbs the ad-hoc
 * `features/superadmin/components/StatTile.tsx` so user + admin surfaces
 * share one implementation.
 *
 * - Variant B — bordered card with an optional footer progress bar
 *   (usage-vs-cap meters, health rollups).
 * - Variant C — KPI card that composes `DeltaPill` in `trailing` +
 *   caption in `caption`.
 *
 * The card is static (BAN-03 — no hover lift, no animated counter).
 */
export interface StatCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Label under the value (localized string). */
  label: React.ReactNode;
  /** The primary number/value (already locale-formatted by the caller). */
  value: React.ReactNode;
  /** Optional icon slot — a lucide *Icon or an <IconTile> child. */
  icon?: React.ReactNode;
  /** Optional trailing content (e.g. a <DeltaPill/> or "vs last month"). */
  trailing?: React.ReactNode;
  /** Optional muted subline (e.g. "than last month"). */
  caption?: React.ReactNode;
  /** Variant-B footer bar. Percent 0..1; tone follows tint recipe. */
  progress?: {
    value: number;
    tone?: 'primary' | 'success' | 'warning' | 'destructive';
    label?: React.ReactNode;
  };
}

const progressToneClass = (
  tone: NonNullable<StatCardProps['progress']>['tone'],
): string => {
  switch (tone) {
    case 'success':
      return 'bg-success';
    case 'warning':
      return 'bg-warning';
    case 'destructive':
      return 'bg-destructive';
    default:
      return 'bg-primary';
  }
};

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(function StatCard(
  { className, label, value, icon, trailing, caption, progress, ...props },
  ref,
) {
  const clamped = progress
    ? Math.max(0, Math.min(1, progress.value))
    : undefined;
  return (
    <Card
      ref={ref}
      data-slot="stat-card"
      className={cn('shadow-xs', className)}
      {...props}
    >
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="mt-0.5 text-2xl font-semibold text-foreground tabular-nums">
              {value}
            </span>
            {caption ? (
              <span className="mt-1 text-xs text-muted-foreground">{caption}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {trailing}
            {icon}
          </div>
        </div>
        {progress && clamped !== undefined ? (
          <div className="flex flex-col gap-1.5">
            {progress.label ? (
              <span className="text-xs text-muted-foreground">{progress.label}</span>
            ) : null}
            <div
              className="h-1 w-full rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(clamped * 100)}
            >
              <div
                className={cn('h-full rounded-full', progressToneClass(progress.tone))}
                style={{ width: `${clamped * 100}%` }}
              />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
});

export { StatCard, IconTile };
