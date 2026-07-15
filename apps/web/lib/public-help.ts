import type {
  PublicHelpArticlePage,
  PublicHelpCenter,
  PublicHelpCollectionPage,
} from "@workspace/contracts/help-center"

export type {
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
