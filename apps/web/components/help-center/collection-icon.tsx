"use client"

import * as React from "react"
import {
  BarChart3,
  BookOpen,
  Code2,
  CreditCard,
  LifeBuoy,
  MessageSquare,
  Puzzle,
  Rocket,
  Settings2,
  Shield,
  Users,
  Zap,
} from "lucide-react"

import { COLLECTION_ICONS } from "@workspace/contracts/help-center"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"

/** Curated collection icons — the single source shared by the panel + builder. */
export const COLLECTION_ICON_MAP = {
  Rocket,
  BookOpen,
  Users,
  BarChart3,
  Code2,
  LifeBuoy,
  Settings2,
  Zap,
  Shield,
  CreditCard,
  Puzzle,
  MessageSquare,
} as const

/** The icon component for a stored name, falling back to BookOpen. */
export function collectionIcon(
  name: string | null | undefined
): React.ComponentType<{ className?: string }> {
  return (
    (name && COLLECTION_ICON_MAP[name as keyof typeof COLLECTION_ICON_MAP]) ||
    BookOpen
  )
}

/**
 * Click the collection's icon to change it — a small popover grid of the
 * curated set (Notion/Linear-style). The trigger renders the current icon.
 */
export function CollectionIconPicker({
  value,
  onSelect,
}: {
  value: string | null | undefined
  onSelect: (icon: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const Current = collectionIcon(value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            aria-label="Change collection icon"
            className="flex size-8 items-center justify-center rounded-lg text-primary outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        }
      >
        <Current className="size-5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <p className="mb-1.5 px-1 text-[11px] font-medium text-muted-foreground">
          Choose an icon
        </p>
        <div className="grid grid-cols-6 gap-1">
          {COLLECTION_ICONS.map((name) => {
            const Icon = COLLECTION_ICON_MAP[name]
            const active = value === name
            return (
              <button
                key={name}
                aria-label={name}
                onClick={() => {
                  onSelect(name)
                  setOpen(false)
                }}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg transition-colors",
                  active
                    ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
