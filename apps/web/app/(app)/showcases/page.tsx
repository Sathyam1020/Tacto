"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { GalleryHorizontalEnd, Plus } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { useSetNavbar } from "@/components/navbar-context"
import { NewShowcaseDialog } from "@/components/showcase/new-showcase-dialog"
import { useShowcases } from "@/lib/showcase"

const LAYOUT_LABEL: Record<string, string> = { SECTION: "Section", CHECKLIST: "Checklist", GALLERY: "Gallery" }

export default function ShowcasesPage() {
  const router = useRouter()
  const { data: showcases, isPending } = useShowcases()
  const [newOpen, setNewOpen] = React.useState(false)
  // Stable callback — just opens the name dialog (no mutation in the navbar
  // handler, so the navbar effect can't loop).
  const openNew = React.useCallback(() => setNewOpen(true), [])

  useSetNavbar(
    {
      leftActions: <h1 className="text-[15px] font-semibold">Showcases</h1>,
      actions: (
        <Button size="sm" onClick={openNew}>
          <Plus className="size-4" />
          New showcase
        </Button>
      ),
    },
    [openNew]
  )

  const empty = !showcases || showcases.length === 0

  return (
    <>
      {/* Always mounted so "New showcase" works in any state (loading/empty/grid). */}
      <NewShowcaseDialog open={newOpen} onOpenChange={setNewOpen} />

      {isPending ? (
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)]" />
          ))}
        </div>
      ) : empty ? (
        <div className="mx-auto flex max-w-md flex-col items-center justify-center pt-24 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <GalleryHorizontalEnd className="size-6" />
          </span>
          <h2 className="mt-5 text-lg font-semibold tracking-tight">Create your first showcase</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Bundle guides and resources into a branded, embeddable collection.
          </p>
          <Button className="mt-6" onClick={openNew}>
            <Plus className="size-4" />
            New showcase
          </Button>
        </div>
      ) : (
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {showcases.map((s) => (
            <button
              key={s.id}
              onClick={() => router.push(`/showcases/${s.id}`)}
              className="group flex flex-col rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-card)] p-5 text-left transition-colors hover:border-primary/40"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <GalleryHorizontalEnd className="size-4" />
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    s.status === "PUBLISHED"
                      ? "bg-[var(--l-success)]/10 text-[var(--l-success)]"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {s.status === "PUBLISHED" && <span className="size-1.5 rounded-full bg-[var(--l-success)]" />}
                  {s.status === "PUBLISHED" ? "Live" : "Draft"}
                </span>
              </div>
              <h3 className="mt-3 truncate text-[15px] font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {LAYOUT_LABEL[s.layout]} · {s.itemCount} {s.itemCount === 1 ? "item" : "items"}
              </p>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
