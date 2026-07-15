"use client"

import * as React from "react"
import { Plus } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { CreateFormDialog } from "@/components/create-form-dialog"
import { useLibraryViewState } from "@/components/app-shell/view-context"
import { EmptyState } from "@/components/datum/empty-state"
import { FormCard } from "@/components/form-card"
import { useSetNavbar } from "@/components/navbar-context"
import { authClient } from "@/lib/auth-client"
import { useFolders } from "@/lib/folders"
import { useForms } from "@/lib/forms"
import { applyFilterSort, filterItems } from "@/lib/library"

export default function FormsPage() {
  const { data: activeWorkspace } = authClient.useActiveOrganization()
  const { data: forms, isPending } = useForms(activeWorkspace?.id)
  const { data: folders } = useFolders(activeWorkspace?.id, "FORM")
  const { view, query } = useLibraryViewState()
  const [createOpen, setCreateOpen] = React.useState(false)

  const filtered = React.useMemo(
    () => applyFilterSort(filterItems(forms ?? [], view, query), "all", "newest"),
    [forms, view, query]
  )

  const title =
    view.type === "all"
      ? "All forms"
      : view.type === "pinned"
        ? "Pinned"
        : view.type === "recent"
          ? "Recent"
          : (folders?.find((f) => f.id === view.id)?.name ?? "Folder")

  useSetNavbar(
    {
      title,
      actions: (
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New form
        </Button>
      ),
    },
    [title]
  )

  return (
    <>
      {isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-[14px] border border-[var(--l-hairline)] bg-[var(--l-card)]"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={query ? "No forms match your search" : "No forms yet"}
          description={
            query
              ? "Try a different search."
              : "Create a form to collect responses — and embed it in your guides."
          }
          action={
            !query && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                New form
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((form) => (
            <FormCard key={form.id} form={form} />
          ))}
          <button
            onClick={() => setCreateOpen(true)}
            className="flex h-full min-h-52 flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-[var(--l-hairline-strong)] text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            <Plus className="size-5" />
            New form
          </button>
        </div>
      )}

      <CreateFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}
