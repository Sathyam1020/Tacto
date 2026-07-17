"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * A floating checklist progress badge — the one embed-specific affordance for a
 * Showcase. Shows a circular countdown of items completed; surfaces progress on
 * small screens and inside embeds where the sidebar checklist is hidden. Uses
 * the brand `--primary` token so it inherits the showcase's color.
 */
export function ChecklistBadge({
  done,
  total,
  className,
}: {
  done: number
  total: number
  className?: string
}) {
  if (total <= 0) return null
  const complete = done >= total
  const R = 13
  const C = 2 * Math.PI * R
  const pct = total > 0 ? done / total : 0

  return (
    <div
      className={cn(
        "pointer-events-none fixed right-4 bottom-4 z-40 flex items-center gap-2.5 rounded-full border border-black/5 bg-white py-2 pr-4 pl-2 shadow-lg dark:border-white/10 dark:bg-[var(--l-card)]",
        className
      )}
      role="status"
      aria-label={`${done} of ${total} complete`}
    >
      <span className="relative flex size-8 flex-none items-center justify-center">
        <svg viewBox="0 0 32 32" className="size-8 -rotate-90">
          <circle cx="16" cy="16" r={R} fill="none" stroke="currentColor" strokeWidth="3" className="text-[var(--l-chrome)]" />
          <circle
            cx="16"
            cy="16"
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct)}
            className="text-primary transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        {complete && (
          <Check className="absolute size-3.5 text-primary" strokeWidth={3} />
        )}
      </span>
      <span className="text-[13px] leading-tight font-medium text-[var(--l-ink)] tabular-nums">
        {complete ? "All done" : `${done} of ${total}`}
      </span>
    </div>
  )
}
