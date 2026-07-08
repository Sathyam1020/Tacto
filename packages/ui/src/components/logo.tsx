import { cn } from "@workspace/ui/lib/utils"

/**
 * Tacto logo — a ring with an off-center point of contact: a click,
 * mid-capture. The ring takes the current text color; the point is always
 * viridian (the touch color), unless `mono` is set for single-color
 * contexts (favicons, stamps, embroidery…).
 */

type LogoMarkProps = React.ComponentProps<"svg"> & {
  /** Render the touch point in currentColor instead of viridian. */
  mono?: boolean
}

function LogoMark({ className, mono = false, ...props }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("size-6 shrink-0", className)}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="9.5"
        strokeWidth="2.5"
        className="stroke-current"
      />
      <circle
        cx="15.5"
        cy="8.5"
        r="3.25"
        className={cn(mono ? "fill-current" : "fill-viridian")}
      />
    </svg>
  )
}

type LogoProps = React.ComponentProps<"span"> & {
  mono?: boolean
  /** Hide the wordmark and show only the mark. */
  markOnly?: boolean
}

function Logo({ className, mono, markOnly = false, ...props }: LogoProps) {
  return (
    <span
      data-slot="logo"
      className={cn("inline-flex items-center gap-2", className)}
      {...props}
    >
      <LogoMark mono={mono} />
      {!markOnly && (
        <span className="text-lg font-semibold tracking-tight">Tacto</span>
      )}
    </span>
  )
}

export { Logo, LogoMark }
