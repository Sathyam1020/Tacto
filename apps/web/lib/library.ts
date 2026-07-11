import type { GuideListItem } from "@/lib/guides"

/** Which slice of the library is showing. */
export type LibraryView =
  | { type: "all" }
  | { type: "pinned" }
  | { type: "recent" }
  | { type: "folder"; id: string }

/** A guide counts as "new activity" if it was created in the last 7 days. */
const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export function isNew(guide: GuideListItem, now: number): boolean {
  return now - new Date(guide.createdAt).getTime() < NEW_WINDOW_MS
}

export type LibraryCounts = {
  all: number
  pinned: number
  recentNew: number
  byFolder: Record<string, number>
  drafts: Record<string, number>
  fresh: Record<string, number>
}

/** Derive the sidebar badges from the real guide list. Pure. */
export function computeCounts(
  guides: GuideListItem[],
  now: number
): LibraryCounts {
  const byFolder: Record<string, number> = {}
  const drafts: Record<string, number> = {}
  const fresh: Record<string, number> = {}
  let recentNew = 0

  for (const g of guides) {
    if (isNew(g, now)) recentNew++
    if (g.folderId) {
      byFolder[g.folderId] = (byFolder[g.folderId] ?? 0) + 1
      if (g.status === "DRAFT") drafts[g.folderId] = (drafts[g.folderId] ?? 0) + 1
      if (isNew(g, now)) fresh[g.folderId] = (fresh[g.folderId] ?? 0) + 1
    }
  }

  return {
    all: guides.length,
    pinned: guides.filter((g) => g.pinnedAt).length,
    recentNew,
    byFolder,
    drafts,
    fresh,
  }
}

export type StatusFilter = "all" | "published" | "draft"
export type SortKey = "newest" | "oldest" | "views" | "title"

/** Status filter + sort, pinned guides always first. Pure. */
export function applyFilterSort(
  guides: GuideListItem[],
  filter: StatusFilter,
  sort: SortKey
): GuideListItem[] {
  let list = guides
  if (filter === "published") list = list.filter((g) => g.status === "PUBLISHED")
  else if (filter === "draft") list = list.filter((g) => g.status === "DRAFT")

  const time = (s: string) => new Date(s).getTime()
  return [...list].sort((a, b) => {
    const pin = (b.pinnedAt ? 1 : 0) - (a.pinnedAt ? 1 : 0)
    if (pin) return pin
    switch (sort) {
      case "oldest":
        return time(a.createdAt) - time(b.createdAt)
      case "views":
        return b.viewCount - a.viewCount
      case "title":
        return a.title.localeCompare(b.title)
      case "newest":
      default:
        return time(b.createdAt) - time(a.createdAt)
    }
  })
}

/** Apply the active view + search query to the guide list. Pure. */
export function filterGuides(
  guides: GuideListItem[],
  view: LibraryView,
  query: string
): GuideListItem[] {
  let list = guides
  if (view.type === "pinned") list = list.filter((g) => g.pinnedAt)
  else if (view.type === "recent")
    list = [...guides].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  else if (view.type === "folder")
    list = list.filter((g) => g.folderId === view.id)

  const q = query.trim().toLowerCase()
  if (q) list = list.filter((g) => g.title.toLowerCase().includes(q))
  return list
}
