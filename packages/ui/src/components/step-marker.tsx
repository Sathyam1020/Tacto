import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

/**
 * StepMarker — a numbered touch ring.
 *
 * The atom of every guide: steps are a true sequence, so the number is
 * information, not decoration. Numbers are set in mono — they are
 * machine-captured facts.
 */

const stepMarkerVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full border font-mono select-none",
  {
    variants: {
      size: {
        sm: "size-5 border text-[10px]",
        default: "size-7 border-[1.5px] text-xs",
        lg: "size-9 border-2 text-sm",
      },
      state: {
        /** Upcoming / at rest: quiet hairline ring. */
        default: "border-border text-muted-foreground",
        /** The step being viewed or edited: the touch color. */
        current: "border-viridian text-viridian",
        /** Done: filled with ink — the touch has happened. */
        completed:
          "border-foreground bg-foreground text-background",
      },
    },
    defaultVariants: {
      size: "default",
      state: "default",
    },
  }
)

type StepMarkerProps = React.ComponentProps<"span"> &
  VariantProps<typeof stepMarkerVariants> & {
    /** 1-based step number. */
    step: number
  }

function StepMarker({
  className,
  size,
  state,
  step,
  ...props
}: StepMarkerProps) {
  return (
    <span
      data-slot="step-marker"
      aria-label={`Step ${step}`}
      className={cn(stepMarkerVariants({ size, state }), className)}
      {...props}
    >
      {step}
    </span>
  )
}

export { StepMarker, stepMarkerVariants }
