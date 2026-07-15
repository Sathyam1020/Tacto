"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { m } from "motion/react"
import {
  ArrowRight,
  BarChart3,
  Check,
  Eye,
  Folder,
  Inbox,
  Link2,
  MoreHorizontal,
  Pin,
  PinOff,
  Share2,
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
  useCloneForm,
  useDeleteForm,
  usePinForm,
  useSetFormFolder,
  type FormListItem,
} from "@/lib/forms"

/**
 * Form card — the library twin of GuideCard, structured identically: a
 * browser-framed hero (a faithful synthetic form mock, since a form has no
 * recorded screenshot), title, one-line description, scannable info chips, the
 * author, and a CTA that morphs on hover. Quick actions (edit / duplicate /
 * share / more) slide in above the full-card link, matching the guide grid.
 */

/* ── derived display data ──────────────────────────────────────────────── */
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

const PREVIEW_ACCENT = "var(--l-skel-accent)"
const PREVIEW_TINT = "var(--l-skel-tint)"

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

/* ── status badge (identical treatment to GuideCard) ───────────────────── */
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

function StatusBadge({ status }: { status: FormListItem["status"] }) {
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
}: {
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--l-lift)] px-1.5 py-1 text-[11px] font-medium text-[var(--l-ink-subtle)] ring-1 ring-inset ring-[var(--l-hairline)]">
      <span className="text-[var(--l-ink-tertiary)]">{icon}</span>
      {children}
    </span>
  )
}

/** Faithful synthetic form mock — a question with answer inputs. Neutral
 *  throughout; a placeholder, never a status signal. */
function SyntheticFormPreview() {
  return (
    <div className="size-full bg-[var(--l-preview-base)] p-4">
      <div
        className="h-2 w-2/5 rounded-full"
        style={{ background: PREVIEW_ACCENT }}
      />
      <div
        className="mt-2 h-2.5 w-4/5 rounded-full"
        style={{ background: PREVIEW_TINT }}
      />
      <div className="mt-3 flex flex-col gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-md border border-[var(--l-hairline)] bg-[var(--l-skel-card)] px-2 py-1.5"
          >
            <div className="size-2.5 rounded-full ring-1 ring-[var(--l-hairline)]" />
            <div className="h-1.5 flex-1 rounded-full bg-[var(--l-hairline)]" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function FormCard({ form }: { form: FormListItem }) {
  const router = useRouter()
  const { data: activeWorkspace } = authClient.useActiveOrganization()
  const { data: currentFolders } = useFolders(activeWorkspace?.id, "FORM")

  const pin = usePinForm()
  const clone = useCloneForm()
  const setFolder = useSetFormFolder()
  const del = useDeleteForm()

  const [menuOpen, setMenuOpen] = React.useState(false)
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const pinned = !!form.pinnedAt
  const responses = form.submitCount
  const completion =
    form.startCount > 0
      ? Math.round((form.submitCount / form.startCount) * 100)
      : 0
  const authorInitials = initialsOf(form.author.name)
  const authorColor = PEOPLE[hashId(form.id) % PEOPLE.length]!.bg

  async function copyLink() {
    if (!form.shareId) {
      toast.error("Publish the form to get a link")
      return
    }
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/f/${form.shareId}`
      )
      toast.success("Link copied")
    } catch {
      toast.error("Couldn't copy the link")
    }
  }

  function cloneForm() {
    clone.mutate(form.id, {
      onSuccess: () => toast.success("Form duplicated"),
      onError: () => toast.error("Couldn't duplicate the form"),
    })
  }

  function moveToFolder(folderId: string, name: string) {
    setFolder.mutate(
      { formId: form.id, folderId },
      {
        onSuccess: () => toast.success(`Moved to ${name}`),
        onError: () => toast.error("Couldn't move the form"),
      }
    )
  }

  function confirmDelete() {
    del.mutate(form.id, {
      onSuccess: () => toast.success("Form deleted"),
      onError: () => toast.error("Couldn't delete the form"),
    })
    setConfirmOpen(false)
  }

  return (
    <m.div
      className={cn(
        "group relative rounded-[14px] border border-[var(--l-hairline)] bg-[var(--l-card)] p-2 shadow-[inset_0_1px_0_var(--l-edge)] transition-[box-shadow,border-color,background-color] duration-300 hover:border-[var(--l-hairline-strong)] hover:bg-[var(--l-card-hover)] hover:shadow-[inset_0_1px_0_var(--l-edge),var(--l-card-shadow)]"
      )}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 320, damping: 26, mass: 0.7 }}
    >
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
          <div className="flex h-7 items-center gap-2 border-b border-[var(--l-hairline)] bg-[var(--l-chrome)] px-3">
            <span className="flex gap-1.5">
              <span className="size-2 rounded-full bg-[var(--l-dot)]" />
              <span className="size-2 rounded-full bg-[var(--l-dot)]" />
              <span className="size-2 rounded-full bg-[var(--l-dot)]" />
            </span>
            <span className="ml-1 flex h-4 min-w-0 flex-1 items-center gap-1 rounded-[5px] bg-[var(--l-preview)] px-2 text-[9px] font-medium text-[var(--l-ink-tertiary)] ring-1 ring-[var(--l-hairline)]">
              <span className="size-1.5 shrink-0 rounded-full bg-[var(--l-dot)]" />
              <span className="truncate">tacto.so/f/{form.shareId ?? form.id}</span>
            </span>
          </div>

          <div className="relative aspect-[2/1] overflow-hidden">
            <div className="absolute inset-0 origin-center transition-transform duration-500 ease-out will-change-transform group-hover:-translate-y-1.5 group-hover:scale-[1.03]">
              <SyntheticFormPreview />
            </div>
            <div className="pointer-events-none absolute top-2 left-2.5 z-30">
              <StatusBadge status={form.status} />
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-1.5 pt-2.5">
        <h3 className="line-clamp-1 text-[14px] font-semibold tracking-[-0.01em] text-foreground/90 transition-colors duration-300 group-hover:text-foreground">
          {form.title}
        </h3>
        {form.description && (
          <p className="mt-1 line-clamp-1 text-[12.5px] leading-relaxed text-muted-foreground">
            {form.description}
          </p>
        )}

        {/* info chips */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Chip icon={<Inbox className="size-3" />}>
            {responses} {responses === 1 ? "response" : "responses"}
          </Chip>
          <Chip icon={<Eye className="size-3" />}>
            {fmtViews(form.viewCount)} views
          </Chip>
          <Chip icon={<BarChart3 className="size-3" />}>{completion}% done</Chip>
        </div>

        {/* footer: creator + updated + CTA */}
        <div className="mt-3 flex items-center justify-between border-t border-[var(--l-hairline)] pt-2.5">
          <div className="flex items-center gap-2.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    className={cn(
                      "relative z-20 flex size-6 items-center justify-center rounded-full text-[9px] font-semibold text-white ring-2 ring-[var(--l-card)] transition-transform duration-300 group-hover:scale-[1.06]",
                      authorColor
                    )}
                  />
                }
              >
                {authorInitials}
              </TooltipTrigger>
              <TooltipContent side="top">{form.author.name}</TooltipContent>
            </Tooltip>
            <span className="text-[11px] text-muted-foreground">
              {formatDate(form.updatedAt)}
            </span>
          </div>

          <span className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-primary-foreground shadow-xs transition-colors duration-200 group-hover:bg-[var(--primary-hover)]">
            Open
            <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>

      {/* Primary navigation target */}
      <Link
        href={`/forms/${form.id}`}
        aria-label={form.title}
        className="absolute inset-0 z-10 rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-cobalt/40"
      />

      {/* Quick actions — above the overlay (hover / focus reveal) */}
      <div className="absolute top-10 right-4 z-20 flex translate-y-1 items-center gap-0.5 rounded-xl border border-[var(--l-hairline-strong)] bg-[var(--l-lift)] p-1 opacity-0 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.65)] transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 focus-within:translate-y-0 focus-within:opacity-100 has-[[data-popup-open]]:translate-y-0 has-[[data-popup-open]]:opacity-100">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                aria-label="Edit"
                onClick={() => router.push(`/forms/${form.id}/edit`)}
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
                onClick={cloneForm}
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
                onClick={() => void copyLink()}
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
            <DropdownMenuItem onClick={() => void copyLink()}>
              <Link2 />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => pin.mutate(form.id)}>
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
                      {form.folderId === f.id && (
                        <Check className="size-4 text-cobalt" />
                      )}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onClick={cloneForm}>
              <CopyIcon size={16} />
              Duplicate
            </DropdownMenuItem>
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
              Delete this form?
            </DialogTitle>
            <DialogDescription>
              “{form.title}” and its responses will be removed. This can’t be
              undone.
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
