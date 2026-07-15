/** Which slice of the library is showing. Section-agnostic (guides or forms). */
export type LibraryView =
  | { type: "all" }
  | { type: "pinned" }
  | { type: "recent" }
  | { type: "folder"; id: string }

/**
 * The minimal shape the library helpers operate on — satisfied by both
 * `GuideListItem` and `FormListItem`, so the sidebar counts, filtering, and
 * sorting are shared across the Guides and Forms libraries.
 */
export type LibraryItem = {
  title: string
  status: "DRAFT" | "PUBLISHED"
  pinnedAt: string | null
  folderId: string | null
  viewCount: number
  createdAt: string
  updatedAt: string
}

/** An item counts as "new activity" if it was created in the last 7 days. */
const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export function isNew(item: LibraryItem, now: number): boolean {
  return now - new Date(item.createdAt).getTime() < NEW_WINDOW_MS
}

export type LibraryCounts = {
  all: number
  pinned: number
  recentNew: number
  byFolder: Record<string, number>
  drafts: Record<string, number>
  fresh: Record<string, number>
}

/** Derive the sidebar badges from the real item list. Pure. */
export function computeCounts(
  items: LibraryItem[],
  now: number
): LibraryCounts {
  const byFolder: Record<string, number> = {}
  const drafts: Record<string, number> = {}
  const fresh: Record<string, number> = {}
  let recentNew = 0

  for (const it of items) {
    if (isNew(it, now)) recentNew++
    if (it.folderId) {
      byFolder[it.folderId] = (byFolder[it.folderId] ?? 0) + 1
      if (it.status === "DRAFT") drafts[it.folderId] = (drafts[it.folderId] ?? 0) + 1
      if (isNew(it, now)) fresh[it.folderId] = (fresh[it.folderId] ?? 0) + 1
    }
  }

  return {
    all: items.length,
    pinned: items.filter((it) => it.pinnedAt).length,
    recentNew,
    byFolder,
    drafts,
    fresh,
  }
}

export type StatusFilter = "all" | "published" | "draft"
export type SortKey = "newest" | "oldest" | "views" | "title"

/** Status filter + sort, pinned items always first. Pure. */
export function applyFilterSort<T extends LibraryItem>(
  items: T[],
  filter: StatusFilter,
  sort: SortKey
): T[] {
  let list = items
  if (filter === "published") list = list.filter((it) => it.status === "PUBLISHED")
  else if (filter === "draft") list = list.filter((it) => it.status === "DRAFT")

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

/** Apply the active view + search query to the item list. Pure. */
export function filterItems<T extends LibraryItem>(
  items: T[],
  view: LibraryView,
  query: string
): T[] {
  let list = items
  if (view.type === "pinned") list = list.filter((it) => it.pinnedAt)
  else if (view.type === "recent")
    list = [...items].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  else if (view.type === "folder")
    list = list.filter((it) => it.folderId === view.id)

  const q = query.trim().toLowerCase()
  if (q) list = list.filter((it) => it.title.toLowerCase().includes(q))
  return list
}

/** Alias — the Guides library imports this name; identical to `filterItems`. */
export const filterGuides = filterItems
