import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * The destructive section. One quiet-but-clearly-dangerous card at the bottom of
 * a page; each action states its consequence in the description, never in a
 * scary color wall. Confirmation lives in the action's dialog, not here.
 */
export function DangerZone({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 overflow-hidden rounded-xl border border-destructive/30">
      <div className="border-b border-destructive/20 bg-destructive/5 px-5 py-3">
        <h2 className="text-[13px] font-semibold tracking-wide text-destructive uppercase">
          Danger zone
        </h2>
      </div>
      <div className="divide-y divide-[var(--l-hairline)]">{children}</div>
    </div>
  )
}

export function DangerAction({
  title,
  description,
  action,
  className,
}: {
  title: string
  description: React.ReactNode
  action: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-center justify-between gap-6 px-5 py-4", className)}>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="flex-none">{action}</div>
    </div>
  )
}
