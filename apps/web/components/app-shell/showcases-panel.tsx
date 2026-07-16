"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@workspace/ui/lib/utils"

import { useCreateShowcase, useShowcases } from "@/lib/showcase"

/** The Showcases second sidebar column: the workspace's showcases + New. */
export function ShowcasesPanel() {
  const router = useRouter()
  const params = useParams<{ id?: string }>()
  const activeId = params?.id
  const { data: showcases, isPending } = useShowcases()
  const create = useCreateShowcase()

  function newShowcase() {
    create.mutate("Untitled showcase", {
      onSuccess: (detail) => router.push(`/showcases/${detail.id}`),
      onError: () => toast.error("Couldn't create the showcase"),
    })
  }

  return (
    <aside className="mt-1.5 mb-1.5 flex w-64 flex-none flex-col overflow-hidden rounded-l-3xl border-t border-r border-b border-l border-[var(--l-hairline)] bg-gradient-to-b from-[var(--l-panel-a)] to-[var(--l-panel-b)]">
      <div className="flex h-14 items-center justify-between border-b border-[var(--l-hairline)] px-4">
        <h2 className="text-[15px] font-semibold tracking-tight">Showcases</h2>
        <button
          aria-label="New showcase"
          onClick={newShowcase}
          disabled={create.isPending}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {isPending ? (
          <div className="space-y-1 px-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-foreground/[0.05]" />
            ))}
          </div>
        ) : (showcases ?? []).length === 0 ? (
          <p className="px-2.5 py-6 text-center text-[13px] text-muted-foreground">
            No showcases yet.
          </p>
        ) : (
          (showcases ?? []).map((s) => {
            const active = activeId === s.id
            return (
              <button
                key={s.id}
                onClick={() => router.push(`/showcases/${s.id}`)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors",
                  active ? "bg-foreground/[0.09] font-medium text-cobalt-ink" : "text-foreground hover:bg-foreground/[0.06]"
                )}
              >
                <span
                  className={cn(
                    "size-1.5 flex-none rounded-full",
                    s.status === "PUBLISHED" ? "bg-[var(--l-success)]" : "bg-muted-foreground/40"
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{s.itemCount}</span>
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
}
