"use client"

import * as React from "react"
import { BookOpen, Loader2, Search } from "lucide-react"
import { icons, type LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { SUGGESTED_COLLECTION_ICONS } from "@workspace/contracts/help-center"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"

import { useUpdateCollection } from "@/lib/help-center"

const ALL_ICON_NAMES = Object.keys(icons)

/** The icon component for a stored name, falling back to BookOpen. */
export function collectionIcon(name: string | null | undefined): LucideIcon {
  return (name && (icons as Record<string, LucideIcon>)[name]) || BookOpen
}

/** "BarChart3" → "Bar Chart 3" for a readable tooltip. */
function humanize(name: string): string {
  return name.replace(/([a-z])([A-Z0-9])/g, "$1 $2").replace(/([0-9])([A-Z])/g, "$1 $2")
}

/**
 * Click the collection's icon to change it — a searchable modal over the full
 * lucide library (1,700+ icons) with name tooltips + a saving state. Owns the
 * update so it can show inline loading and close on success.
 */
export function CollectionIconPicker({
  collectionId,
  value,
}: {
  collectionId: string
  value: string | null | undefined
}) {
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState("")
  const [saving, setSaving] = React.useState<string | null>(null)
  const update = useUpdateCollection()
  const Current = collectionIcon(value)

  const results = React.useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return [...SUGGESTED_COLLECTION_ICONS]
    return ALL_ICON_NAMES.filter((n) => n.toLowerCase().includes(t)).slice(0, 180)
  }, [q])

  function pick(name: string) {
    if (saving) return
    setSaving(name)
    update.mutate(
      { id: collectionId, icon: name },
      {
        onSuccess: () => {
          setSaving(null)
          setOpen(false)
          setQ("")
        },
        onError: () => {
          setSaving(null)
          toast.error("Couldn't update the icon")
        },
      }
    )
  }

  return (
    <>
      <button
        aria-label="Change collection icon"
        onClick={() => setOpen(true)}
        className="flex size-8 items-center justify-center rounded-lg text-primary outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <Current className="size-5" />
      </button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setQ("")
        }}
      >
        <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-[var(--l-hairline)] px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Choose an icon</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2.5 border-b border-[var(--l-hairline)] px-4">
            <Search className="size-4 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search 1,700+ icons…"
              className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-[50vh] overflow-y-auto p-3">
            {!q.trim() && (
              <p className="mb-2 px-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Popular
              </p>
            )}
            <div className="grid grid-cols-8 gap-1.5">
              {results.map((name) => {
                const Icon = (icons as Record<string, LucideIcon>)[name]
                if (!Icon) return null
                const active = value === name
                const busy = saving === name
                return (
                  <button
                    key={name}
                    title={humanize(name)}
                    disabled={!!saving}
                    onClick={() => pick(name)}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-lg transition-colors",
                      active
                        ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      saving && !busy && "opacity-40"
                    )}
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
                  </button>
                )
              })}
            </div>
            {q.trim() && results.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No icons match “{q}”.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
