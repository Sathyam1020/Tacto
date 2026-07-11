"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Clock, Folder, FolderOpen, MoreHorizontal, Plus, Star, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { SearchIcon } from "@workspace/ui/components/search"
import { SquarePenIcon } from "@workspace/ui/components/square-pen"
import { cn } from "@workspace/ui/lib/utils"

import {
  FolderIndicators,
  ViewRow,
} from "@/components/app-shell/shell-bits"
import { useLibraryViewState } from "@/components/app-shell/view-context"
import { authClient } from "@/lib/auth-client"
import {
  useCreateFolder,
  useDeleteFolder,
  useRenameFolder,
} from "@/lib/folders"
import { useFolders } from "@/lib/folders"
import { useGuides } from "@/lib/guides"
import { computeCounts, type LibraryView } from "@/lib/library"

export function FoldersPanel() {
  const router = useRouter()
  const pathname = usePathname()
  const { view, setView, query, setQuery } = useLibraryViewState()
  const { data: activeWorkspace } = authClient.useActiveOrganization()
  const { data: guides } = useGuides(activeWorkspace?.id)
  const { data: folders } = useFolders(activeWorkspace?.id)

  const createFolder = useCreateFolder()
  const renameFolder = useRenameFolder()
  const deleteFolder = useDeleteFolder()

  const [creating, setCreating] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [renaming, setRenaming] = React.useState<string | null>(null)

  const counts = React.useMemo(
    () => computeCounts(guides ?? [], Date.now()),
    [guides]
  )

  // A restored/active folder that no longer exists → fall back to All guides.
  React.useEffect(() => {
    if (view.type === "folder" && folders && !folders.some((f) => f.id === view.id)) {
      setView({ type: "all" })
    }
  }, [view, folders, setView])

  /** Selecting a view/folder navigates to the library if we're elsewhere. */
  function go(v: LibraryView) {
    setView(v)
    if (pathname !== "/home") router.push("/home")
  }

  function submitNewFolder() {
    const name = newName.trim()
    if (!name) {
      setCreating(false)
      setNewName("")
      return
    }
    createFolder.mutate(name, {
      onSuccess: (folder) => go({ type: "folder", id: folder.id }),
      onError: () => toast.error("Couldn't create the folder"),
    })
    setNewName("")
    setCreating(false)
  }

  function submitRename(folderId: string, name: string) {
    const trimmed = name.trim()
    setRenaming(null)
    if (!trimmed) return
    renameFolder.mutate(
      { folderId, name: trimmed },
      { onError: () => toast.error("Couldn't rename the folder") }
    )
  }

  function removeFolder(folderId: string) {
    deleteFolder.mutate(folderId, {
      onSuccess: () => {
        toast.success("Folder deleted")
        if (view.type === "folder" && view.id === folderId)
          setView({ type: "all" })
      },
      onError: () => toast.error("Couldn't delete the folder"),
    })
  }

  return (
    <aside className="mt-1.5 mb-1.5 flex w-64 flex-none flex-col overflow-hidden rounded-l-3xl border-t border-r border-b border-l border-[var(--l-hairline)] bg-gradient-to-b from-[var(--l-panel-a)] to-[var(--l-panel-b)]">
      <div className="flex h-14 items-center justify-between border-b px-4">
        <h2 className="text-[15px] font-semibold tracking-tight">Library</h2>
        <button
          aria-label="New folder"
          onClick={() => setCreating(true)}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="px-3 pt-3">
        <div className="flex h-8 items-center gap-2 rounded-lg border bg-plate px-2.5 transition-colors focus-within:border-cobalt">
          <SearchIcon size={14} className="text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search guides"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <ViewRow
          active={view.type === "all"}
          onClick={() => go({ type: "all" })}
          icon={
            <svg
              className="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 9h18" />
            </svg>
          }
          label="All guides"
          count={counts.all}
        />
        <ViewRow
          active={view.type === "pinned"}
          onClick={() => go({ type: "pinned" })}
          icon={<Star className="size-4" />}
          label="Pinned"
          count={counts.pinned}
        />
        <ViewRow
          active={view.type === "recent"}
          onClick={() => go({ type: "recent" })}
          icon={<Clock className="size-4" />}
          label="Recent"
          newBadge={counts.recentNew}
        />

        <div className="mt-4 mb-1 flex items-center justify-between px-2.5">
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Folders
          </span>
          <button
            aria-label="New folder"
            onClick={() => setCreating(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        {(folders ?? []).map((f) => {
          const active = view.type === "folder" && view.id === f.id
          if (renaming === f.id) {
            return (
              <input
                key={f.id}
                autoFocus
                defaultValue={f.name}
                onBlur={(e) => submitRename(f.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur()
                  if (e.key === "Escape") setRenaming(null)
                }}
                className="mx-0.5 mb-0.5 w-[calc(100%-4px)] rounded-lg border border-cobalt bg-plate px-2.5 py-1.5 text-[13px] outline-none"
              />
            )
          }
          return (
            <div
              key={f.id}
              className={cn(
                "group flex items-center rounded-lg pr-1 transition-colors",
                active ? "bg-cobalt-tint" : "hover:bg-muted"
              )}
            >
              <button
                onClick={() => go({ type: "folder", id: f.id })}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-[13px]",
                  active ? "font-medium text-cobalt-ink" : "text-foreground"
                )}
              >
                {active ? (
                  <FolderOpen className="size-4 flex-none text-cobalt" />
                ) : (
                  <Folder className="size-4 flex-none text-muted-foreground" />
                )}
                <span className="truncate">{f.name}</span>
              </button>
              <span className="mr-1 group-hover:hidden">
                <FolderIndicators
                  hasNew={!!counts.fresh[f.id]}
                  reviewCount={counts.drafts[f.id] ?? 0}
                  total={counts.byFolder[f.id] ?? 0}
                  active={active}
                />
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`${f.name} actions`}
                  className="hidden size-6 items-center justify-center rounded-md text-muted-foreground group-hover:flex hover:text-foreground data-[popup-open]:flex data-[popup-open]:text-foreground"
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => setRenaming(f.id)}>
                    <SquarePenIcon size={15} />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => removeFolder(f.id)}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}

        {creating && (
          <div className="mt-0.5 px-0.5">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={submitNewFolder}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNewFolder()
                if (e.key === "Escape") {
                  setCreating(false)
                  setNewName("")
                }
              }}
              placeholder="Folder name"
              className="w-full rounded-lg border border-cobalt bg-plate px-2.5 py-1.5 text-[13px] outline-none"
            />
          </div>
        )}
      </div>
    </aside>
  )
}
