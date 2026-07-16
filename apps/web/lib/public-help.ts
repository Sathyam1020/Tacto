import type {
  HelpSearchHit,
  PublicHelpArticlePage,
  PublicHelpCenter,
  PublicHelpCollectionPage,
} from "@workspace/contracts/help-center"

export type {
  HelpSearchHit,
  PublicHelpArticle,
  PublicHelpArticlePage,
  PublicHelpCenter,
  PublicHelpChrome,
  PublicHelpCollection,
  PublicHelpCollectionPage,
} from "@workspace/contracts/help-center"

const base = process.env.API_URL ?? "http://localhost:4100"

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${base}${path}`, { cache: "no-store" })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function fetchHelpHome(slug: string): Promise<PublicHelpCenter | null> {
  const d = await get<{ helpCenter: PublicHelpCenter }>(
    `/api/public/help/${encodeURIComponent(slug)}`
  )
  return d?.helpCenter ?? null
}

export async function fetchHelpCollection(
  slug: string,
  cslug: string
): Promise<PublicHelpCollectionPage | null> {
  const d = await get<{ page: PublicHelpCollectionPage }>(
    `/api/public/help/${encodeURIComponent(slug)}/${encodeURIComponent(cslug)}`
  )
  return d?.page ?? null
}

export async function fetchHelpArticle(
  slug: string,
  cslug: string,
  aslug: string
): Promise<PublicHelpArticlePage | null> {
  const d = await get<{ page: PublicHelpArticlePage }>(
    `/api/public/help/${encodeURIComponent(slug)}/${encodeURIComponent(cslug)}/${encodeURIComponent(aslug)}`
  )
  return d?.page ?? null
}

/**
 * Full-text article search. Works on the server (absolute API base, for the
 * SSR results page) and in the browser (relative `/api` proxy, for the live
 * ⌘K/`/` overlay). Empty/failed queries resolve to `[]`.
 */
export async function fetchHelpSearch(
  slug: string,
  q: string,
  init?: RequestInit
): Promise<HelpSearchHit[]> {
  const term = q.trim()
  if (!term) return []
  const prefix = typeof window === "undefined" ? base : ""
  const path = `/api/public/help/${encodeURIComponent(slug)}/search?q=${encodeURIComponent(term)}`
  try {
    const res = await fetch(`${prefix}${path}`, { cache: "no-store", ...init })
    if (!res.ok) return []
    const d = (await res.json()) as { hits: HelpSearchHit[] }
    return d.hits ?? []
  } catch {
    return []
  }
}
