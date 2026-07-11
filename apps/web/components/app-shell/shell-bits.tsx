"use client"

import * as React from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

/** Reticle brand mark — the workspace-switcher trigger glyph. */
export function Reticle({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="11" cy="11" r="4.4" />
      <circle cx="11" cy="11" r="1.6" fill="currentColor" stroke="none" />
      <path d="M11 1.5v3M11 17.5v3M1.5 11h3M17.5 11h3" />
    </svg>
  )
}

/** Rail icon button with a right-side tooltip. */
export function RailButton({
  active,
  label,
  onClick,
  children,
}: {
  active?: boolean
  label: string
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            aria-label={label}
            onClick={onClick}
            className={cn(
              "flex size-10 items-center justify-center rounded-xl transition-[color,background-color,box-shadow,transform] duration-150 active:scale-90",
              active
                ? "bg-[var(--l-lift)] text-cobalt shadow-[inset_0_1px_0_var(--l-edge)]"
                : "text-muted-foreground hover:bg-[var(--l-hover)] hover:text-foreground"
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

/** Folders-panel view row (All guides / Pinned / Recent). */
export function ViewRow({
  active,
  onClick,
  icon,
  label,
  count,
  newBadge,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  count?: number
  newBadge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-150",
        active
          ? "bg-foreground/[0.09] font-medium text-cobalt-ink"
          : "text-foreground hover:bg-foreground/[0.06]"
      )}
    >
      <span className={active ? "text-cobalt" : "text-muted-foreground"}>
        {icon}
      </span>
      {label}
      <span className="ml-auto flex items-center gap-1.5">
        {newBadge ? (
          <span className="rounded-full bg-cobalt px-1.5 py-px font-mono text-[9px] font-semibold text-white">
            {newBadge} new
          </span>
        ) : null}
        {count !== undefined ? (
          <span
            className={cn(
              "font-mono text-[10px]",
              active ? "text-cobalt-ink/70" : "text-muted-foreground"
            )}
          >
            {count}
          </span>
        ) : null}
      </span>
    </button>
  )
}

/* Folder-row indicators — one component, one meaning per mark:
   • blue dot        → new / unread guide activity (last 7 days)
   • pill (n)        → n guides need review (drafts)
   • gray number     → total guide count (no action needed) */
export function FolderIndicators({
  hasNew,
  reviewCount,
  total,
  active,
}: {
  hasNew: boolean
  reviewCount: number
  total: number
  active: boolean
}) {
  return (
    <span className="flex items-center gap-1.5">
      {hasNew ? (
        <span
          className="size-1.5 rounded-full bg-cobalt"
          title="New guide activity"
        />
      ) : null}
      {reviewCount > 0 ? (
        <span
          title={`${reviewCount} guide${reviewCount > 1 ? "s" : ""} need review`}
          className="rounded bg-amber-tint px-1.5 py-px font-mono text-[9px] font-medium text-amber-ink"
        >
          {reviewCount}
        </span>
      ) : null}
      <span
        title={`${total} guide${total === 1 ? "" : "s"}`}
        className={cn(
          "font-mono text-[10px]",
          active ? "text-cobalt-ink/70" : "text-muted-foreground"
        )}
      >
        {total}
      </span>
    </span>
  )
}
