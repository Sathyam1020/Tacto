import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * The one grouping primitive for every settings page: a titled section with an
 * optional description, optional right-aligned actions, and content. Sections
 * stack with hairline separators — calm and minimal, no heavy cards.
 */
export function SettingSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "border-b border-[var(--l-hairline)] py-8 first:pt-0 last:border-b-0",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="max-w-prose text-[13px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex-none">{actions}</div>}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </section>
  )
}

/** A page wrapper: constrains width and gives the sections a column. */
export function SettingsPage({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-2xl">{children}</div>
}
