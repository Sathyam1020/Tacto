import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

/**
 * TouchRing — Tacto's signature mark: a ring around a point of contact.
 *
 * Every appearance means "a moment of touch". Use it for:
 *  - click indicators on captured screenshots (`static`)
 *  - the live capture state (`pulse`)
 *  - AI processing states (`processing`)
 *
 * Tone rule: `touch` (viridian) for interaction; `recording` (signal red)
 * is reserved for the live-recording state only.
 */

const touchRingVariants = cva("relative inline-block shrink-0", {
  variants: {
    size: {
      sm: "size-4",
      default: "size-6",
      lg: "size-9",
      xl: "size-14",
    },
    tone: {
      touch: "text-viridian",
      recording: "text-signal",
      neutral: "text-current",
    },
  },
  defaultVariants: {
    size: "default",
    tone: "touch",
  },
})

type TouchRingProps = React.ComponentProps<"span"> &
  VariantProps<typeof touchRingVariants> & {
    variant?: "static" | "pulse" | "processing"
    /** Accessible label. Omit for purely decorative use (defaults to hidden). */
    label?: string
  }

/** r=10 in a 24-box → circumference ≈ 62.83; matches --ring-circumference default. */
const RING_CIRCUMFERENCE = 2 * Math.PI * 10

function TouchRing({
  className,
  size,
  tone,
  variant = "static",
  label,
  ...props
}: TouchRingProps) {
  return (
    <span
      data-slot="touch-ring"
      className={cn(touchRingVariants({ size, tone }), className)}
      {...(label
        ? { role: "status", "aria-label": label }
        : { "aria-hidden": true })}
      {...props}
    >
      {variant === "processing" ? (
        <svg viewBox="0 0 24 24" fill="none" className="size-full -rotate-90">
          {/* Track */}
          <circle
            cx="12"
            cy="12"
            r="10"
            strokeWidth="2"
            className="stroke-current opacity-20"
          />
          {/* Arc that draws itself closed while the AI works. With reduced
              motion the animation is disabled and the static partial arc
              below remains visible. */}
          <circle
            cx="12"
            cy="12"
            r="10"
            strokeWidth="2"
            strokeLinecap="round"
            className="animate-ring-draw motion-reduce:animate-none stroke-current"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE * 0.72}
          />
        </svg>
      ) : (
        <>
          {/* Core ring */}
          <span className="absolute inset-0 rounded-full border-2 border-current" />
          {/* Point of contact */}
          <span className="absolute inset-[34%] rounded-full bg-current" />
          {variant === "pulse" && (
            /* Echo ring radiating outward — hidden when motion is reduced. */
            <span className="animate-touch-pulse absolute inset-0 rounded-full border-2 border-current motion-reduce:hidden" />
          )}
        </>
      )}
    </span>
  )
}

export { TouchRing, touchRingVariants }
