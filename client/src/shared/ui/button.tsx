import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/shared/lib/utils"
import { Spinner } from "./spinner"

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// React 18: refs must be forwarded explicitly (ref-as-prop is React 19).
// Radix `asChild` triggers (DropdownMenu, Tooltip, Popover…) anchor their
// popper on this ref — without forwardRef the menu renders off-screen.
//
// `loading` implements the interaction-hygiene rule: the button disables
// immediately (no double-submit), swaps its leading icon for the shared
// `Spinner`, and restores when the caller flips the flag back — on success
// AND on error. Children stay visible so the width and label never jump.
// `loading` is a no-op when `asChild` is set (the Slot renders arbitrary
// markup — the caller owns its own affordance).
const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean
      loading?: boolean
    }
>(function Button(
  {
    className,
    variant = "default",
    size = "default",
    asChild = false,
    loading = false,
    disabled,
    children,
    ...props
  },
  ref
) {
  const Comp = asChild ? Slot.Root : "button"
  const showSpinner = loading && !asChild
  const isDisabled = asChild ? disabled : disabled || loading

  return (
    <Comp
      ref={ref}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={showSpinner ? "" : undefined}
      aria-busy={showSpinner || undefined}
      disabled={isDisabled}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {showSpinner ? <Spinner aria-hidden="true" /> : null}
          {children}
        </>
      )}
    </Comp>
  )
})

export { Button, buttonVariants }
