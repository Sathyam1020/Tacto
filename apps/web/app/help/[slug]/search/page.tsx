import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { HelpSearchResults } from "@/components/help/help-site"
import { fetchHelpHome, fetchHelpSearch } from "@/lib/public-help"

/** Deep-linkable / SEO search results over the center's published articles.
 *  The interactive ⌘K overlay hits the same endpoint; this page is the
 *  shareable, JS-optional surface. */
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string }> }

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const [{ slug }, { q }] = await Promise.all([params, searchParams])
  const home = await fetchHelpHome(slug)
  if (!home) return { title: "Search" }
  const query = (q ?? "").trim()
  return {
    title: query ? `“${query}” · ${home.name}` : `Search · ${home.name}`,
    // Search result pages are never indexed (thin, query-dependent).
    robots: { index: false, follow: true },
  }
}

export default async function HelpSearchPage({ params, searchParams }: Params) {
  const [{ slug }, { q }] = await Promise.all([params, searchParams])
  const home = await fetchHelpHome(slug)
  if (!home) notFound()
  const query = (q ?? "").trim()
  const initialHits = query ? await fetchHelpSearch(slug, query) : []
  return <HelpSearchResults chrome={home} query={query} initialHits={initialHits} />
}
