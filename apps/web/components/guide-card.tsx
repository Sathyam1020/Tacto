"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Copy,
  FolderInput,
  Link2,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react"
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
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"

import { authClient } from "@/lib/auth-client"
import { formatDate } from "@/lib/format"
import {
  useCloneGuide,
  useDeleteGuide,
  useMoveGuide,
  usePinGuide,
  usePublishGuide,
  type GuideListItem,
} from "@/lib/guides"

/**
 * Guide card — tinted cover with the serif title, quiet footer with the
 * machine metadata. Once captures carry screenshots, the cover becomes the
 * first step's image; the tint stays as fallback.
 *
 * On hover the card lifts and reveals a kebab menu (copy link, edit, pin,
 * clone, move, delete). The menu is a sibling of the cover link so its
 * clicks never trigger navigation.
 */

const COVER_TINTS = [
  "bg-ink text-paper dark:bg-paper dark:text-ink", // ink
  "bg-viridian text-white", // viridian
  "bg-[#4A6FA5] text-white", // slate
  "bg-[#B98A2E] text-white", // amber
] as const

function coverTint(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  return COVER_TINTS[Math.abs(hash) % COVER_TINTS.length]!
}

export function GuideCard({ guide }: { guide: GuideListItem }) {
  const router = useRouter()
  const { data: activeWorkspace } = authClient.useActiveOrganization()
  const { data: workspaces } = authClient.useListOrganizations()

  const pin = usePinGuide()
  const clone = useCloneGuide()
  const move = useMoveGuide()
  const del = useDeleteGuide()
  const publish = usePublishGuide(guide.id)

  const [menuOpen, setMenuOpen] = React.useState(false)
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const pinned = !!guide.pinnedAt
  const otherWorkspaces = (workspaces ?? []).filter(
    (w) => w.id !== activeWorkspace?.id
  )

  async function copyLink() {
    try {
      let shareId = guide.shareId
      if (!shareId) {
        const res = await publish.mutateAsync(true)
        shareId = res.guide.shareId
      }
      await navigator.clipboard.writeText(
        `${window.location.origin}/g/${shareId}`
      )
      toast.success(guide.shareId ? "Link copied" : "Published & link copied")
    } catch {
      toast.error("Couldn't copy the link")
    }
  }

  function togglePin() {
    pin.mutate(guide.id, {
      onSuccess: () => toast.success(pinned ? "Unpinned" : "Pinned to top"),
      onError: () => toast.error("Couldn't update pin"),
    })
  }

  function cloneGuide() {
    clone.mutate(guide.id, {
      onSuccess: () => toast.success("Guide duplicated"),
      onError: () => toast.error("Couldn't duplicate the guide"),
    })
  }

  function moveTo(organizationId: string, name: string) {
    move.mutate(
      { guideId: guide.id, organizationId },
      {
        onSuccess: () => toast.success(`Moved to ${name}`),
        onError: () => toast.error("Couldn't move the guide"),
      }
    )
  }

  function confirmDelete() {
    del.mutate(guide.id, {
      onSuccess: () => toast.success("Guide deleted"),
      onError: () => toast.error("Couldn't delete the guide"),
    })
    setConfirmOpen(false)
  }

  return (
    <div className="group relative rounded-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">
      <Link
        href={`/guides/${guide.id}`}
        className="bg-card focus-visible:ring-ring/50 group-hover:border-viridian/30 block overflow-hidden rounded-xl border outline-none transition-colors focus-visible:ring-3"
      >
        {guide.coverUrl ? (
          <div className="relative aspect-[16/9] overflow-hidden border-b">
            {/* Real screenshot cover (presigned URL, expires — plain img). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={guide.coverUrl}
              alt=""
              className="size-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </div>
        ) : (
          <div
            className={cn(
              "flex aspect-[16/9] items-center justify-center p-6",
              coverTint(guide.id)
            )}
          >
            <span className="line-clamp-3 text-center font-serif text-xl leading-snug text-balance">
              {guide.title}
            </span>
          </div>
        )}
        {guide.coverUrl && (
          <p className="truncate px-4 pt-3 font-serif text-base leading-snug">
            {guide.title}
          </p>
        )}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-muted-foreground font-mono text-xs">
            {guide.stepCount} steps · {formatDate(guide.createdAt)}
          </span>
          <span className="text-muted-foreground group-hover:text-viridian text-xs transition-colors">
            Open →
          </span>
        </div>
      </Link>

      {/* Pin indicator */}
      {pinned && (
        <span
          className="bg-ink/75 pointer-events-none absolute top-2 left-2 z-10 flex size-7 items-center justify-center rounded-full text-white shadow-sm backdrop-blur"
          aria-label="Pinned"
        >
          <Pin className="size-3.5 fill-current" />
        </span>
      )}

      {/* Kebab menu — sibling of the link, so clicks never navigate. */}
      <div
        className={cn(
          "absolute top-2 right-2 z-10 transition-opacity focus-within:opacity-100 group-hover:opacity-100",
          menuOpen ? "opacity-100" : "opacity-0"
        )}
      >
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            aria-label="Guide actions"
            className="bg-card/90 hover:bg-card focus-visible:ring-ring/50 flex size-8 items-center justify-center rounded-lg border shadow-sm outline-none backdrop-blur transition-colors focus-visible:ring-2"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={copyLink}>
              <Link2 />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push(`/guides/${guide.id}/edit`)}
            >
              <Pencil />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={togglePin}>
              {pinned ? <PinOff /> : <Pin />}
              {pinned ? "Unpin" : "Pin"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={cloneGuide}>
              <Copy />
              Clone
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInput />
                Move
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                {otherWorkspaces.length === 0 ? (
                  <DropdownMenuItem disabled>
                    No other workspace
                  </DropdownMenuItem>
                ) : (
                  otherWorkspaces.map((w) => (
                    <DropdownMenuItem
                      key={w.id}
                      onClick={() => moveTo(w.id, w.name)}
                    >
                      {w.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete confirmation */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-medium tracking-tight">
              Delete this guide?
            </DialogTitle>
            <DialogDescription>
              “{guide.title}” will be removed from your workspace. This can’t be
              undone from here.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
