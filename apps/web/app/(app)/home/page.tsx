"use client"

import * as React from "react"
import { AnimatePresence, m } from "motion/react"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FolderOpen,
  ListFilter,
  Star,
} from "lucide-react"
import { RotateCCWIcon } from "@workspace/ui/components/rotate-ccw"
import { XIcon } from "@workspace/ui/components/x"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { TouchRing } from "@workspace/ui/components/touch-ring"

import { BulkBar } from "@/components/app-shell/bulk-bar"
import { CaptureButton } from "@/components/capture-button"
import { useLibraryViewState } from "@/components/app-shell/view-context"
import { EmptyState } from "@/components/datum/empty-state"
import { staggerItem } from "@/components/datum/motion"
import { GuideCard } from "@/components/guide-card"
import { useSetNavbar } from "@/components/navbar-context"
import { authClient } from "@/lib/auth-client"
import { useFolders, useRenameFolder } from "@/lib/folders"
import {
  useActiveCaptures,
  useDismissCapture,
  useGuides,
  useRetryCapture,
  type ActiveCapture,
} from "@/lib/guides"
import {
  applyFilterSort,
  filterGuides,
  type SortKey,
  type StatusFilter,
} from "@/lib/library"

const PAGE_SIZE = 12

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "views", label: "Most viewed" },
  { key: "title", label: "Title A–Z" },
]
const STATUSES: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Draft" },
]

/** Status + sort dropdown for the current view. */
function FilterMenu({
  filter,
  setFilter,
  sort,
  setSort,
}: {
  filter: StatusFilter
  setFilter: (f: StatusFilter) => void
  sort: SortKey
  setSort: (s: SortKey) => void
}) {
  const active = filter !== "all" || sort !== "newest"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" className="flex-none" />}
      >
        <ListFilter className="size-4" />
        <span className="max-sm:hidden">Filter</span>
        {active && (
          <span className="ml-0.5 size-1.5 rounded-full bg-primary" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Status
          </DropdownMenuLabel>
          {STATUSES.map((s) => (
            <DropdownMenuItem
              key={s.key}
              onClick={() => setFilter(s.key)}
              closeOnClick={false}
            >
              <span className="flex-1">{s.label}</span>
              {filter === s.key && <Check className="size-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Sort by
          </DropdownMenuLabel>
          {SORTS.map((s) => (
            <DropdownMenuItem
              key={s.key}
              onClick={() => setSort(s.key)}
              closeOnClick={false}
            >
              <span className="flex-1">{s.label}</span>
              {sort === s.key && <Check className="size-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Page controls under the grid. */
function Pager({
  page,
  pageCount,
  onPage,
}: {
  page: number
  pageCount: number
  onPage: (p: number) => void
}) {
  if (pageCount <= 1) return null
  return (
    <div className="mt-8 flex items-center justify-center gap-3">
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="font-mono text-xs text-muted-foreground">
        Page {page} of {pageCount}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}

/** Pull the API's human-readable error message, if any. */
function apiMessage(error: unknown): string | undefined {
  const e = error as { response?: { data?: { error?: { message?: string } } } }
  return e.response?.data?.error?.message
}

/** Loading placeholder shaped like a real GuideCard (same grid + proportions). */
function GuideCardSkeleton() {
  return (
    <div className="rounded-[14px] border border-[var(--l-hairline)] bg-[var(--l-card)] p-2">
      <Skeleton className="aspect-[2/1] rounded-[10px]" />
      <div className="px-1.5 pt-3">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="mt-2 h-3 w-full" />
        <div className="mt-3 flex gap-1.5">
          <Skeleton className="h-5 w-14 rounded-md" />
          <Skeleton className="h-5 w-14 rounded-md" />
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[var(--l-hairline)] pt-2.5">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    </div>
  )
}

/* Grid fade + stagger — crossfades between views. */
const gridV = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, when: "beforeChildren" as const },
  },
  exit: { opacity: 0, transition: { duration: 0.12 } },
}

/** Constant library header — tracked date eyebrow + time-aware greeting. */
function LibraryGreeting({ name }: { name: string | undefined }) {
  const [now, setNow] = React.useState<Date | null>(null)
  React.useEffect(() => setNow(new Date()), [])

  const who = name ? `, ${name}` : ""
  const dateLabel = now
    ? now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : " "
  const hour = now?.getHours() ?? -1
  const greeting =
    hour < 0
      ? " "
      : hour < 5
        ? `Working late${who}.`
        : hour < 12
          ? `Good morning${who}.`
          : hour < 17
            ? `Good afternoon${who}.`
            : hour < 22
              ? `Good evening${who}.`
              : `Working late${who}.`

  return (
    <div className="mb-6">
      <p className="font-mono text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
        {dateLabel}
      </p>
      <h2 className="mt-1.5 text-[26px] font-semibold tracking-[-0.02em] text-foreground">
        {greeting}
      </h2>
    </div>
  )
}

/**
 * A capture still uploading/processing, or one that failed. Failed cards offer
 * Retry (when the source survives) and Dismiss; in-flight cards get a hover ×
 * to cancel a stuck one — so no capture is ever a dead-end.
 */
function CaptureCard({
  capture,
  workspaceId,
}: {
  capture: ActiveCapture
  workspaceId: string | undefined
}) {
  const failed = capture.status === "FAILED"
  const retry = useRetryCapture(workspaceId)
  const dismiss = useDismissCapture(workspaceId)
  const busy = retry.isPending || dismiss.isPending

  function onRetry() {
    retry.mutate(capture.id, {
      onSuccess: () => toast.success("Retrying capture…"),
      onError: (error) =>
        toast.error(apiMessage(error) ?? "Couldn't retry this capture"),
    })
  }

  function onDismiss() {
    dismiss.mutate(capture.id, {
      onSuccess: () => toast.success("Capture dismissed"),
      onError: () => toast.error("Couldn't dismiss this capture"),
    })
  }

  return (
    <div className="group relative overflow-hidden rounded-[14px] border border-[var(--l-hairline)] bg-[var(--l-card)] p-2">
      {!failed && (
        <button
          aria-label="Cancel capture"
          onClick={onDismiss}
          disabled={busy}
          className="absolute top-3 right-3 z-10 flex size-7 items-center justify-center rounded-lg bg-[var(--l-chrome)] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100 disabled:opacity-50"
        >
          <XIcon size={16} />
        </button>
      )}

      <div className="flex aspect-[2/1] flex-col items-center justify-center gap-3 rounded-[10px] bg-[var(--l-preview)]">
        <TouchRing
          variant={failed ? "static" : "processing"}
          tone={failed ? "recording" : "touch"}
          size="lg"
          label={failed ? "Processing failed" : "Processing"}
        />
      </div>

      <div className="px-1.5 pt-2.5">
        <span className="block truncate text-[14px] font-medium">
          {capture.title || "Untitled capture"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 px-1.5 pt-1 pb-1">
        <span
          className={
            failed
              ? "text-xs text-destructive"
              : "font-mono text-xs text-muted-foreground"
          }
        >
          {failed
            ? (capture.errorMessage ?? "Processing failed")
            : capture.status === "UPLOADING"
              ? "waiting for upload…"
              : "writing your guide…"}
        </span>
        {failed && (
          <div className="flex shrink-0 items-center gap-1.5">
            {capture.retryable && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                disabled={busy}
              >
                <RotateCCWIcon size={15} />
                Retry
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              disabled={busy}
            >
              Dismiss
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Library — greeting + every guide in the active view, as cards. */
export default function HomePage() {
  const { data: session } = authClient.useSession()
  const { data: activeWorkspace } = authClient.useActiveOrganization()
  const { data: guides, isPending } = useGuides(activeWorkspace?.id)
  const { data: folders } = useFolders(activeWorkspace?.id)
  const { data: activeCaptures } = useActiveCaptures(activeWorkspace?.id)
  const { view, query } = useLibraryViewState()
  const renameFolder = useRenameFolder()
  const inFlight = activeCaptures ?? []
  const firstName = session?.user.name.trim().split(/\s+/)[0]

  const [filter, setFilter] = React.useState<StatusFilter>("all")
  const [sort, setSort] = React.useState<SortKey>("newest")
  const [page, setPage] = React.useState(1)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [renaming, setRenaming] = React.useState(false)

  const filtered = React.useMemo(
    () => applyFilterSort(filterGuides(guides ?? [], view, query), filter, sort),
    [guides, view, query, filter, sort]
  )

  const viewFolderId = view.type === "folder" ? view.id : null
  const title =
    view.type === "all"
      ? "All guides"
      : view.type === "pinned"
        ? "Pinned"
        : view.type === "recent"
          ? "Recent"
          : (folders?.find((f) => f.id === view.id)?.name ?? "Folder")

  // Reset the page whenever the slice of guides changes; clear selection on a
  // view switch (folder change) so it never carries across contexts.
  React.useEffect(() => setPage(1), [view, query, filter, sort])
  React.useEffect(() => {
    setSelected(new Set())
    setRenaming(false)
  }, [view])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  function toggleSelect(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function submitRename(value: string) {
    setRenaming(false)
    const name = value.trim()
    if (!viewFolderId || !name || name === title) return
    renameFolder.mutate(
      { folderId: viewFolderId, name },
      { onError: () => toast.error("Couldn't rename the folder") }
    )
  }

  // Navbar: view icon + (rename-able) title + count on the left.
  useSetNavbar(
    {
      leftActions: renaming ? (
        <input
          autoFocus
          defaultValue={title}
          onBlur={(e) => submitRename(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur()
            if (e.key === "Escape") setRenaming(false)
          }}
          aria-label="Folder name"
          className="w-48 rounded-md border border-cobalt bg-plate px-2 py-1 text-[15px] font-semibold outline-none"
        />
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          {view.type === "folder" ? (
            <FolderOpen className="size-4 flex-none text-muted-foreground" />
          ) : view.type === "pinned" ? (
            <Star className="size-4 flex-none text-muted-foreground" />
          ) : view.type === "recent" ? (
            <Clock className="size-4 flex-none text-muted-foreground" />
          ) : null}
          {view.type === "folder" ? (
            <button
              onClick={() => setRenaming(true)}
              title="Rename folder"
              className="truncate text-[15px] font-semibold hover:underline"
            >
              {title}
            </button>
          ) : (
            <h1 className="truncate text-[15px] font-semibold">{title}</h1>
          )}
          <span className="font-mono text-[11px] text-muted-foreground">
            {filtered.length} guide{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      ),
    },
    [view.type, viewFolderId, title, filtered.length, renaming]
  )

  const viewKey = view.type === "folder" ? `folder-${view.id}` : view.type
  const empty = !isPending && filtered.length === 0 && inFlight.length === 0

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <LibraryGreeting name={firstName} />
        <div className="mt-1 flex shrink-0 items-center gap-2">
          <AnimatePresence>
            {selected.size > 0 && (
              <BulkBar
                selectedIds={[...selected]}
                onClear={() => setSelected(new Set())}
              />
            )}
          </AnimatePresence>
          <FilterMenu
            filter={filter}
            setFilter={setFilter}
            sort={sort}
            setSort={setSort}
          />
        </div>
      </div>

      {isPending && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <GuideCardSkeleton key={i} />
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {empty ? (
          <EmptyState
            key={`empty-${viewKey}`}
            className="mt-6"
            title={
              query
                ? "No guides match your search"
                : filter !== "all"
                  ? `No ${filter} guides here`
                  : `No guides in ${title} yet`
            }
            description={
              query || filter !== "all"
                ? "Try a different filter or search term."
                : "Record a workflow, or move an existing guide into this view."
            }
            action={<CaptureButton folderId={viewFolderId} />}
          />
        ) : !isPending ? (
          <m.div
            key={`${viewKey}-${currentPage}-${filter}-${sort}`}
            variants={gridV}
            initial="hidden"
            animate="show"
            exit="exit"
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {currentPage === 1 &&
              inFlight.map((capture) => (
                <m.div key={capture.id} variants={staggerItem}>
                  <CaptureCard
                    capture={capture}
                    workspaceId={activeWorkspace?.id}
                  />
                </m.div>
              ))}
            {pageItems.map((guide) => (
              <m.div key={guide.id} variants={staggerItem}>
                <GuideCard
                  guide={guide}
                  selected={selected.has(guide.id)}
                  onSelectChange={(on) => toggleSelect(guide.id, on)}
                />
              </m.div>
            ))}
            {currentPage === pageCount && (
              <m.div key="__add" variants={staggerItem} className="h-full">
                <CaptureButton variant="card" folderId={viewFolderId} />
              </m.div>
            )}
          </m.div>
        ) : null}
      </AnimatePresence>

      {!empty && !isPending && (
        <Pager page={currentPage} pageCount={pageCount} onPage={setPage} />
      )}
    </>
  )
}
