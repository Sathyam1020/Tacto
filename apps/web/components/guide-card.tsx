"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { m } from "motion/react"
import {
  ArrowRight,
  Check,
  CircleCheck,
  Clock,
  Eye,
  Folder,
  Layers,
  Link2,
  MoreHorizontal,
  Pin,
  PinOff,
  Share2,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"

import { CopyIcon } from "@workspace/ui/components/copy"
import { DeleteIcon } from "@workspace/ui/components/delete"
import { FolderInputIcon } from "@workspace/ui/components/folder-input"
import { SquarePenIcon } from "@workspace/ui/components/square-pen"

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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

import { authClient } from "@/lib/auth-client"
import { useFolders } from "@/lib/folders"
import { formatDate } from "@/lib/format"
import {
  useCloneGuide,
  useDeleteGuide,
  useMoveGuide,
  usePinGuide,
  usePublishGuide,
  useSetGuideFolder,
  type GuideListItem,
} from "@/lib/guides"

/**
 * Guide card — a premium workflow asset. The hero is a browser-framed preview
 * of the recorded guide (the real first-step screenshot once captures carry
 * one, a faithful synthetic app mock until then). Below it: title, one-line
 * description, scannable info chips, collaborators, and a CTA that morphs into
 * a button on hover.
 *
 * Hover lifts the card on a spring, deepens the shadow, scales + pans the
 * preview, blooms a soft blue glow behind it, and slides in quick actions.
 * The whole surface is one navigation target (an inset Link overlay); the
 * quick actions sit above it so their clicks never navigate.
 *
 * Analytics fields (views, completion, est. time, collaborators, AI flag) are
 * derived deterministically from the guide today — swap for real values when
 * the analytics backend lands.
 */

/* ── derived display data (deterministic placeholders) ─────────────────── */
function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return Math.abs(h)
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase()
}

// One neutral tone (per theme) for every skeleton preview — the placeholder is
// not a status signal, so it stays consistent across all cards.
const PREVIEW_ACCENT = "var(--l-skel-accent)"
const PREVIEW_TINT = "var(--l-skel-tint)"

// Muted gray / lavender-gray avatars that read on either card surface.
const PEOPLE = [
  { initials: "AK", bg: "bg-[#4a4d55]" },
  { initials: "MR", bg: "bg-[#585c66]" },
  { initials: "JL", bg: "bg-[#676b76]" },
  { initials: "SP", bg: "bg-[#4d5488]" },
  { initials: "TN", bg: "bg-[#7a7fad]" },
] as const

function fmtViews(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n)
}

/* ── small pieces ──────────────────────────────────────────────────────── */
// Surface pill + ink text (well past AA). Status is carried by a small semantic
// dot: success-green for published, neutral gray for draft.
const STATUS = {
  PUBLISHED: {
    label: "Published",
    dot: "bg-[var(--l-success)]",
    ring: "ring-[var(--l-success-ring)]",
  },
  DRAFT: {
    label: "Draft",
    dot: "bg-[var(--l-ink-tertiary)]",
    ring: "ring-[var(--l-hairline-strong)]",
  },
} as const

function StatusBadge({ status }: { status: GuideListItem["status"] }) {
  const s = STATUS[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-[var(--l-chrome)] px-2 py-1 text-[10.5px] font-semibold text-[var(--l-ink)] ring-1",
        s.ring
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  )
}

function Chip({
  icon,
  children,
  colorClass,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  /** Overrides the default neutral bg/text/ring (e.g. completion tiering). */
  colorClass?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium ring-1 ring-inset",
        colorClass ??
          "bg-[var(--l-lift)] text-[var(--l-ink-subtle)] ring-[var(--l-hairline)]"
      )}
    >
      <span className={colorClass ? undefined : "text-[var(--l-ink-tertiary)]"}>
        {icon}
      </span>
      {children}
    </span>
  )
}

/** Faithful synthetic app screenshot for guides without a real cover yet.
 *  Neutral dark throughout — a placeholder, never a status signal. */
function SyntheticPreview() {
  return (
    <div className="size-full bg-[var(--l-preview-base)]">
      <div className="flex h-[15%] items-center gap-1.5 border-b border-[var(--l-hairline)] px-3">
        <div
          className="size-2.5 rounded-[5px]"
          style={{ background: PREVIEW_ACCENT }}
        />
        <div className="h-1.5 w-12 rounded-full bg-[var(--l-hairline)]" />
        <div className="ml-auto flex items-center gap-1">
          <div className="size-2 rounded-full bg-[var(--l-hairline)]" />
          <div className="h-2 w-6 rounded-full bg-[var(--l-hairline)]" />
        </div>
      </div>
      <div className="flex h-[85%]">
        <div className="flex w-[24%] flex-col gap-1.5 border-r border-[var(--l-hairline)] p-2.5">
          <div
            className="h-2 w-full rounded-full"
            style={{ background: PREVIEW_TINT }}
          />
          <div className="h-1.5 w-4/5 rounded-full bg-[var(--l-hairline)]" />
          <div className="h-1.5 w-full rounded-full bg-[var(--l-hairline)]" />
          <div className="h-1.5 w-3/5 rounded-full bg-[var(--l-hairline)]" />
        </div>
        <div className="flex-1 p-3">
          <div
            className="h-2.5 w-1/2 rounded-full"
            style={{ background: PREVIEW_TINT }}
          />
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="rounded-lg border border-[var(--l-hairline)] bg-[var(--l-skel-card)] p-2"
              >
                <div
                  className="h-1.5 w-2/3 rounded-full"
                  style={{ background: PREVIEW_TINT }}
                />
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-[var(--l-hairline)]" />
              </div>
            ))}
          </div>
          <div className="mt-2.5 space-y-1.5">
            <div className="h-1.5 w-full rounded-full bg-[var(--l-hairline)]" />
            <div className="h-1.5 w-11/12 rounded-full bg-[var(--l-hairline)]" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** A destination-workspace row that expands to that workspace's folder list.
 *  Folders are fetched only when the submenu opens (no fetch storm per card). */
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

export function GuideCard({
  guide,
  selected = false,
  onSelectChange,
}: {
  guide: GuideListItem
  /** When onSelectChange is provided, the status badge becomes a checkbox. */
  selected?: boolean
  onSelectChange?: (selected: boolean) => void
}) {
  const selectable = onSelectChange !== undefined
  const router = useRouter()
  const { data: activeWorkspace } = authClient.useActiveOrganization()
  const { data: workspaces } = authClient.useListOrganizations()

  const pin = usePinGuide()
  const clone = useCloneGuide()
  const move = useMoveGuide()
  const setFolder = useSetGuideFolder()
  const del = useDeleteGuide()
  const publish = usePublishGuide(guide.id)
  const { data: currentFolders } = useFolders(activeWorkspace?.id)

  const [menuOpen, setMenuOpen] = React.useState(false)
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const pinned = !!guide.pinnedAt
  const otherWorkspaces = (workspaces ?? []).filter(
    (w) => w.id !== activeWorkspace?.id
  )

  // Derived, deterministic display metrics (placeholder until analytics land).
  // Real where we track it; an estimate for time; an empty state for completion
  // (not tracked yet). The author avatar is the real creator.
  const minutes = Math.max(1, Math.round(guide.stepCount * 0.6))
  const views = guide.viewCount
  const ai = guide.aiGenerated
  const authorInitials = initialsOf(guide.author.name)
  const authorColor = PEOPLE[hashId(guide.id) % PEOPLE.length]!.bg

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
    // Toast + optimistic reorder live in the hook so they fire reliably.
    pin.mutate(guide.id)
  }

  function cloneGuide() {
    clone.mutate(guide.id, {
      onSuccess: () => toast.success("Guide duplicated"),
      onError: () => toast.error("Couldn't duplicate the guide"),
    })
  }

  function moveToFolder(folderId: string, name: string) {
    setFolder.mutate(
      { guideId: guide.id, folderId },
      {
        onSuccess: () => toast.success(`Moved to ${name}`),
        onError: () => toast.error("Couldn't move the guide"),
      }
    )
  }

  function moveToWorkspaceFolder(
    organizationId: string,
    folderId: string,
    label: string
  ) {
    move.mutate(
      { guideId: guide.id, organizationId, folderId },
      {
        onSuccess: () => toast.success(`Moved to ${label}`),
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
    <m.div
      className={cn(
        "group relative rounded-[14px] border bg-[var(--l-card)] p-2 shadow-[inset_0_1px_0_var(--l-edge)] transition-[box-shadow,border-color,background-color] duration-300 hover:bg-[var(--l-card-hover)] hover:shadow-[inset_0_1px_0_var(--l-edge),var(--l-card-shadow)]",
        selected
          ? "border-primary ring-1 ring-primary"
          : "border-[var(--l-hairline)] hover:border-[var(--l-hairline-strong)]"
      )}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 320, damping: 26, mass: 0.7 }}
    >
      {/* Pinned — floats at the outer top-left corner of the card, clear of the
          preview chrome. */}
      {pinned && (
        <span
          className="pointer-events-none absolute -top-2 -left-2 z-30 flex size-6 items-center justify-center rounded-full bg-cobalt text-white shadow-[0_2px_8px_rgba(94,106,210,0.5)] ring-2 ring-[var(--l-chrome)]"
          aria-label="Pinned"
        >
          <Pin className="size-3 fill-current" />
        </span>
      )}

      {/* Browser preview hero */}
      <div className="relative">
        <div className="relative overflow-hidden rounded-[12px] border border-[var(--l-hairline)] bg-[var(--l-preview)]">
          {/* browser chrome */}
          <div className="flex h-7 items-center gap-2 border-b border-[var(--l-hairline)] bg-[var(--l-chrome)] px-3">
            <span className="flex gap-1.5">
              <span className="size-2 rounded-full bg-[var(--l-dot)]" />
              <span className="size-2 rounded-full bg-[var(--l-dot)]" />
              <span className="size-2 rounded-full bg-[var(--l-dot)]" />
            </span>
            <span className="ml-1 flex h-4 min-w-0 flex-1 items-center gap-1 rounded-[5px] bg-[var(--l-preview)] px-2 text-[9px] font-medium text-[var(--l-ink-tertiary)] ring-1 ring-[var(--l-hairline)]">
              <span className="size-1.5 shrink-0 rounded-full bg-[var(--l-dot)]" />
              <span className="truncate">
                tacto.so/g/{guide.shareId ?? guide.id}
              </span>
            </span>
          </div>

          {/* screenshot */}
          <div className="relative aspect-[2/1] overflow-hidden">
            <div className="absolute inset-0 origin-center transition-transform duration-500 ease-out will-change-transform group-hover:-translate-y-1.5 group-hover:scale-[1.03]">
              {guide.coverUrl ? (
                // Real screenshot cover (presigned URL, expires — plain img).
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={guide.coverUrl}
                  alt=""
                  className="size-full object-cover object-top"
                />
              ) : (
                <SyntheticPreview />
              )}
            </div>
            {/* status (top-left) — becomes a select checkbox on hover / when
                selected. The container is click-transparent; only the visible
                checkbox catches clicks, so the rest still navigates. */}
            <div className="pointer-events-none absolute top-2 left-2.5 z-30">
              {selectable ? (
                <>
                  <div
                    className={cn(
                      "transition-opacity duration-150",
                      selected
                        ? "pointer-events-auto opacity-100"
                        : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
                    )}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      aria-label={selected ? "Deselect guide" : "Select guide"}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectChange?.(!selected)
                      }}
                      className={cn(
                        "flex size-[18px] items-center justify-center rounded-[6px] border shadow-sm backdrop-blur-sm transition-[background-color,border-color,transform] duration-150 active:scale-90",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-white/70 bg-black/45 text-transparent hover:border-white"
                      )}
                    >
                      <Check
                        className={cn(
                          "size-3 transition-transform duration-150 ease-out",
                          selected ? "scale-100" : "scale-50"
                        )}
                        strokeWidth={3.25}
                      />
                    </button>
                  </div>
                  <div
                    className={cn(
                      "absolute inset-0 transition-opacity duration-150",
                      selected
                        ? "opacity-0"
                        : "opacity-100 group-hover:opacity-0"
                    )}
                  >
                    <StatusBadge status={guide.status} />
                  </div>
                </>
              ) : (
                <StatusBadge status={guide.status} />
              )}
            </div>

            {/* AI badge (top-right, cross-fades with quick actions) */}
            {ai && (
              <div className="pointer-events-none absolute top-2 right-2.5 z-20 transition-opacity duration-200 group-hover:opacity-0">
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--l-ai-bg)] px-2 py-1 text-[10px] font-bold text-[var(--l-ai-text)] ring-1 ring-[var(--l-ai-ring)]">
                  <Sparkles className="size-3" />
                  AI
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-1.5 pt-2.5">
        <h3 className="line-clamp-1 text-[14px] font-semibold tracking-[-0.01em] text-foreground/90 transition-colors duration-300 group-hover:text-foreground">
          {guide.title}
        </h3>
        {guide.summary && (
          <p className="mt-1 line-clamp-1 text-[12.5px] leading-relaxed text-muted-foreground">
            {guide.summary}
          </p>
        )}

        {/* info chips */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Chip icon={<Layers className="size-3" />}>
            {guide.stepCount} steps
          </Chip>
          <Chip icon={<Clock className="size-3" />}>~{minutes} min</Chip>
          <Chip icon={<Eye className="size-3" />}>{fmtViews(views)} views</Chip>
        </div>

        {/* footer: creator + updated + CTA */}
        <div className="mt-3 flex items-center justify-between border-t border-[var(--l-hairline)] pt-2.5">
          <div className="flex items-center gap-2.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    onClick={() => router.push(`/guides/${guide.id}`)}
                    className={cn(
                      "relative z-20 flex size-6 cursor-pointer items-center justify-center rounded-full text-[9px] font-semibold text-white ring-2 ring-[var(--l-card)] transition-transform duration-300 group-hover:scale-[1.06]",
                      authorColor
                    )}
                  />
                }
              >
                {authorInitials}
              </TooltipTrigger>
              <TooltipContent side="top">{guide.author.name}</TooltipContent>
            </Tooltip>
            <span className="text-[11px] text-muted-foreground">
              {formatDate(guide.updatedAt)}
            </span>
          </div>

          <span className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-primary-foreground shadow-xs transition-colors duration-200 group-hover:bg-[var(--primary-hover)]">
            Open
            <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>

      {/* Primary navigation target — inset overlay so the whole card is one
          click, and interactive controls above it never navigate. */}
      <Link
        href={`/guides/${guide.id}`}
        aria-label={guide.title}
        className="absolute inset-0 z-10 rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-cobalt/40"
      />

      {/* Quick actions — above the overlay (hover / focus reveal) */}
      <div className="absolute top-10 right-4 z-20 flex translate-y-1 items-center gap-0.5 rounded-xl border border-[var(--l-hairline-strong)] bg-[var(--l-lift)] p-1 opacity-0 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.65)] transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 focus-within:translate-y-0 focus-within:opacity-100 has-[[data-popup-open]]:translate-y-0 has-[[data-popup-open]]:opacity-100">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                aria-label="Edit"
                onClick={() => router.push(`/guides/${guide.id}/edit`)}
                className="flex size-7 items-center justify-center rounded-lg text-[var(--l-ink-subtle)] transition-colors hover:bg-[var(--l-hairline)] hover:text-[var(--l-ink)]"
              />
            }
          >
            <SquarePenIcon size={15} />
          </TooltipTrigger>
          <TooltipContent side="bottom">Edit</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                aria-label="Duplicate"
                onClick={cloneGuide}
                className="flex size-7 items-center justify-center rounded-lg text-[var(--l-ink-subtle)] transition-colors hover:bg-[var(--l-hairline)] hover:text-[var(--l-ink)]"
              />
            }
          >
            <CopyIcon size={15} />
          </TooltipTrigger>
          <TooltipContent side="bottom">Duplicate</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                aria-label="Share"
                onClick={copyLink}
                className="flex size-7 items-center justify-center rounded-lg text-[var(--l-ink-subtle)] transition-colors hover:bg-[var(--l-hairline)] hover:text-[var(--l-ink)]"
              />
            }
          >
            <Share2 className="size-[15px]" />
          </TooltipTrigger>
          <TooltipContent side="bottom">Share</TooltipContent>
        </Tooltip>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            aria-label="More actions"
            className="flex size-7 items-center justify-center rounded-lg text-[var(--l-ink-subtle)] transition-colors outline-none hover:bg-[var(--l-hairline)] hover:text-[var(--l-ink)] data-[popup-open]:bg-[var(--l-hairline)] data-[popup-open]:text-[var(--l-ink)]"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={copyLink}>
              <Link2 />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={togglePin}>
              {pinned ? <PinOff /> : <Pin />}
              {pinned ? "Unpin" : "Pin to top"}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInputIcon size={16} />
                Move to folder
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">
                {(currentFolders ?? []).length === 0 ? (
                  <DropdownMenuItem disabled>No folders</DropdownMenuItem>
                ) : (
                  (currentFolders ?? []).map((f) => (
                    <DropdownMenuItem
                      key={f.id}
                      onClick={() => moveToFolder(f.id, f.name)}
                    >
                      <Folder className="size-4" />
                      <span className="flex-1 truncate">{f.name}</span>
                      {guide.folderId === f.id && (
                        <Check className="size-4 text-cobalt" />
                      )}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {otherWorkspaces.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderInputIcon size={16} />
                  Move to workspace
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-52">
                  {otherWorkspaces.map((w) => (
                    <WorkspaceFolderSub
                      key={w.id}
                      workspaceId={w.id}
                      workspaceName={w.name}
                      onPick={(folderId, folderName) =>
                        moveToWorkspaceFolder(
                          w.id,
                          folderId,
                          `${w.name} · ${folderName}`
                        )
                      }
                    />
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <DeleteIcon size={16} />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete confirmation */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight">
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
    </m.div>
  )
}
