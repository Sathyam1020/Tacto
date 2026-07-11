"use client"

import * as React from "react"
import { m } from "motion/react"
import { Folder, FolderInput, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

import { authClient } from "@/lib/auth-client"
import { useFolders } from "@/lib/folders"
import {
  useDeleteGuide,
  useMoveGuide,
  useSetGuideFolder,
} from "@/lib/guides"

/** Lazily lists a destination workspace's folders when its submenu opens. */
function WorkspaceFolderSub({
  workspaceId,
  workspaceName,
  onPick,
}: {
  workspaceId: string
  workspaceName: string
  onPick: (folderId: string, folderName: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const { data: folders } = useFolders(open ? workspaceId : undefined)
  return (
    <DropdownMenuSub open={open} onOpenChange={setOpen}>
      <DropdownMenuSubTrigger>
        <span className="flex size-5 items-center justify-center rounded bg-ink text-[9px] font-semibold text-paper">
          {workspaceName.charAt(0).toUpperCase()}
        </span>
        <span className="flex-1 truncate">{workspaceName}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-52">
        {folders === undefined ? (
          <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
        ) : folders.length === 0 ? (
          <DropdownMenuItem disabled>No folders</DropdownMenuItem>
        ) : (
          folders.map((f) => (
            <DropdownMenuItem key={f.id} onClick={() => onPick(f.id, f.name)}>
              <Folder className="size-4" />
              <span className="flex-1 truncate">{f.name}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

/** Inline bulk-action bar (sits in the toolbar) shown while guides are selected. */
export function BulkBar({
  selectedIds,
  onClear,
}: {
  selectedIds: string[]
  onClear: () => void
}) {
  const { data: activeWorkspace } = authClient.useActiveOrganization()
  const { data: workspaces } = authClient.useListOrganizations()
  const { data: folders } = useFolders(activeWorkspace?.id)
  const setFolder = useSetGuideFolder()
  const move = useMoveGuide()
  const del = useDeleteGuide()

  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const count = selectedIds.length
  const otherWorkspaces = (workspaces ?? []).filter(
    (w) => w.id !== activeWorkspace?.id
  )

  async function runAll(
    fn: (id: string) => Promise<unknown>,
    done: string
  ) {
    setBusy(true)
    try {
      await Promise.all(selectedIds.map(fn))
      toast.success(done)
      onClear()
    } catch {
      toast.error("Something went wrong — try again")
    } finally {
      setBusy(false)
    }
  }

  const label = `${count} guide${count === 1 ? "" : "s"}`

  // Explicit hover / open / pressed states — the ghost default is too faint on
  // the lifted bar surface.
  const btnCls =
    "hover:bg-[var(--l-hairline-strong)] hover:text-foreground active:scale-90 data-[popup-open]:bg-[var(--l-hairline-strong)] data-[popup-open]:text-foreground"

  return (
    <>
      <m.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.15 }}
        className="flex items-center gap-0.5 rounded-lg border border-[var(--l-hairline-strong)] bg-[var(--l-lift)] p-1 pl-2.5 shadow-[0_8px_24px_-10px_rgba(0,0,0,0.4)]"
      >
        <span className="mr-1 text-[13px] font-medium whitespace-nowrap text-foreground">
          {count} selected
        </span>
        <span className="mx-0.5 h-5 w-px bg-[var(--l-hairline)]" />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="sm" disabled={busy} className={btnCls} />}
          >
            <FolderInput className="size-4" />
            <span className="max-sm:hidden">Move to folder</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end" className="w-52">
            {(folders ?? []).length === 0 ? (
              <DropdownMenuItem disabled>No folders</DropdownMenuItem>
            ) : (
              (folders ?? []).map((f) => (
                <DropdownMenuItem
                  key={f.id}
                  onClick={() =>
                    void runAll(
                      (id) => setFolder.mutateAsync({ guideId: id, folderId: f.id }),
                      `Moved ${label} to ${f.name}`
                    )
                  }
                >
                  <Folder className="size-4" />
                  <span className="flex-1 truncate">{f.name}</span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {otherWorkspaces.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="sm" disabled={busy} className={btnCls} />}
            >
              <FolderInput className="size-4" />
              <span className="max-sm:hidden">Move to workspace</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="end" className="w-52">
              {otherWorkspaces.map((w) => (
                <WorkspaceFolderSub
                  key={w.id}
                  workspaceId={w.id}
                  workspaceName={w.name}
                  onPick={(folderId, folderName) =>
                    void runAll(
                      (id) =>
                        move.mutateAsync({
                          guideId: id,
                          organizationId: w.id,
                          folderId,
                        }),
                      `Moved ${label} to ${w.name} · ${folderName}`
                    )
                  }
                />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => setConfirmOpen(true)}
          className="text-destructive hover:bg-destructive/15 hover:text-destructive active:scale-90"
        >
          <Trash2 className="size-4" />
          <span className="max-sm:hidden">Delete</span>
        </Button>

        <span className="mx-0.5 h-5 w-px bg-[var(--l-hairline)]" />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Clear selection"
          onClick={onClear}
          disabled={busy}
          className={btnCls}
        >
          <X className="size-4" />
        </Button>
      </m.div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Delete {label}?
            </DialogTitle>
            <DialogDescription>
              {count === 1 ? "This guide" : "These guides"} will be removed from
              your workspace. This can’t be undone from here.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false)
                void runAll(
                  (id) => del.mutateAsync(id),
                  `Deleted ${label}`
                )
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
