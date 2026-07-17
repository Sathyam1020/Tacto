"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import {
  LayoutGrid,
  ListChecks,
  MoreHorizontal,
  Plus,
  Rows3,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import type { ShowcaseLayout } from "@workspace/contracts/showcase"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { SquarePenIcon } from "@workspace/ui/components/square-pen"
import { cn } from "@workspace/ui/lib/utils"

import { ConfirmDialog } from "@/components/settings/confirm-dialog"
import { NewShowcaseDialog } from "@/components/showcase/new-showcase-dialog"
import { useDeleteShowcase, useRenameShowcase, useShowcases } from "@/lib/showcase"

const LAYOUT_ICON: Record<ShowcaseLayout, React.ComponentType<{ className?: string }>> = {
  SECTION: Rows3,
  CHECKLIST: ListChecks,
  GALLERY: LayoutGrid,
}

/** The Showcases second sidebar column: the workspace's showcases + New. */
export function ShowcasesPanel() {
  const router = useRouter()
  const params = useParams<{ id?: string }>()
  const activeId = params?.id
  const { data: showcases, isPending } = useShowcases()
  const rename = useRenameShowcase()
  const del = useDeleteShowcase()

  const [newOpen, setNewOpen] = React.useState(false)
  const [renaming, setRenaming] = React.useState<string | null>(null)
  const [deleting, setDeleting] = React.useState<{ id: string; title: string } | null>(null)

  function submitRename(id: string, value: string) {
    setRenaming(null)
    const title = value.trim()
    if (title) rename.mutate({ id, title }, { onError: () => toast.error("Couldn't rename") })
  }

  return (
    <aside className="mt-1.5 mb-1.5 flex w-64 flex-none flex-col overflow-hidden rounded-l-3xl border-t border-r border-b border-l border-[var(--l-hairline)] bg-gradient-to-b from-[var(--l-panel-a)] to-[var(--l-panel-b)]">
      <div className="flex h-14 items-center justify-between border-b border-[var(--l-hairline)] px-4">
        <h2 className="text-[15px] font-semibold tracking-tight">Showcases</h2>
        <button
          aria-label="New showcase"
          onClick={() => setNewOpen(true)}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {isPending ? (
          <div className="space-y-1.5 px-0.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-lg bg-foreground/[0.05]" />
            ))}
          </div>
        ) : (showcases ?? []).length === 0 ? (
          <button
            onClick={() => setNewOpen(true)}
            className="mt-2 flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-[var(--l-hairline-strong)] px-3 py-6 text-center text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Plus className="size-4" />
            New showcase
          </button>
        ) : (
          (showcases ?? []).map((s) => {
            const Icon = LAYOUT_ICON[s.layout]
            const active = activeId === s.id
            if (renaming === s.id) {
              return (
                <input
                  key={s.id}
                  autoFocus
                  defaultValue={s.title}
                  onBlur={(e) => submitRename(s.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur()
                    if (e.key === "Escape") setRenaming(null)
                  }}
                  className="mx-0.5 mb-0.5 w-[calc(100%-4px)] rounded-lg border border-cobalt bg-plate px-2.5 py-2 text-[13px] outline-none"
                />
              )
            }
            return (
              <div
                key={s.id}
                className={cn(
                  "group mb-0.5 flex items-center rounded-lg pr-1 transition-colors",
                  active ? "bg-foreground/[0.09]" : "hover:bg-foreground/[0.06]"
                )}
              >
                <button
                  onClick={() => router.push(`/showcases/${s.id}`)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left"
                >
                  <span
                    className={cn(
                      "flex size-7 flex-none items-center justify-center rounded-md",
                      active ? "bg-primary/15 text-cobalt" : "bg-foreground/[0.06] text-muted-foreground"
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-[13px]", active ? "font-medium text-cobalt-ink" : "text-foreground")}>
                      {s.title}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className={cn("size-1.5 rounded-full", s.status === "PUBLISHED" ? "bg-[var(--l-success)]" : "bg-muted-foreground/40")} />
                      {s.status === "PUBLISHED" ? "Live" : "Draft"} · {s.itemCount}
                    </span>
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`${s.title} actions`}
                    className="hidden size-6 items-center justify-center rounded-md text-muted-foreground group-hover:flex hover:text-foreground data-[popup-open]:flex data-[popup-open]:text-foreground"
                  >
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => setRenaming(s.id)}>
                      <SquarePenIcon size={15} />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleting({ id: s.id, title: s.title })}>
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          })
        )}
      </div>

      <NewShowcaseDialog open={newOpen} onOpenChange={setNewOpen} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.title ?? "showcase"}?`}
        description="This permanently deletes the showcase and its sections. The guides and forms it references stay intact."
        confirmLabel="Delete showcase"
        confirmText={deleting?.title}
        onConfirm={async () => {
          if (!deleting) return
          const wasActive = activeId === deleting.id
          await del.mutateAsync(deleting.id)
          setDeleting(null)
          if (wasActive) router.push("/showcases")
        }}
      />
    </aside>
  )
}
