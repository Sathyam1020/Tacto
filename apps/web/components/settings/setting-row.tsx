import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * A single label/description ↔ control row. Wrap a group of rows in
 * `<SettingRows>` for consistent hairline separators + spacing.
 */
export function SettingRow({
  label,
  description,
  htmlFor,
  children,
  className,
}: {
  label: React.ReactNode
  description?: React.ReactNode
  htmlFor?: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-center justify-between gap-6 py-4 first:pt-0 last:pb-0", className)}>
      <div className="min-w-0 space-y-0.5">
        <label htmlFor={htmlFor} className="block text-sm font-medium">
          {label}
        </label>
        {description && (
          <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {children && <div className="flex flex-none items-center gap-2">{children}</div>}
    </div>
  )
}

/** Hairline-separated stack of `SettingRow`s. */
export function SettingRows({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("divide-y divide-[var(--l-hairline)]", className)}>{children}</div>
}
