import { cn } from "@/shared/lib/utils"

/**
 * Minimal monochrome progress bar. Radix is not a dependency here, so this is a
 * plain ARIA progressbar: `bg-muted` track with a `bg-primary` fill clamped to
 * [0, 100]. `value`/`max` drive both the fill width and the ARIA attributes.
 */
function Progress({
  className,
  value = 0,
  max = 100,
  ...props
}: Omit<React.ComponentProps<"div">, "role" | "aria-valuenow"> & {
  value?: number
  max?: number
}) {
  const safeMax = max > 0 ? max : 100
  const pct = Math.min(100, Math.max(0, (value / safeMax) * 100))
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={value}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className="h-full rounded-full bg-primary transition-[width]"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export { Progress }
