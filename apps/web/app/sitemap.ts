import type { MetadataRoute } from "next"

import { allPosts } from "@/lib/marketing/blog"
import { COMPARISONS } from "@/lib/marketing/compare"
import { LEGAL_DOCS } from "@/lib/marketing/legal"
import { TOOLS } from "@/lib/marketing/tools"
import { USE_CASES } from "@/lib/marketing/use-cases"

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://tacto.fyi"
const API = process.env.API_URL || "http://localhost:4100"

/** Static + data-driven marketing routes (everything under (marketing)). */
function marketingRoutes(): MetadataRoute.Sitemap {
  const top = [
    "/pricing",
    "/features",
    "/solutions",
    "/use-cases",
    "/compare",
    "/blog",
    "/tools",
    "/docs",
    "/changelog",
    "/media-kit",
    "/contact",
    "/chrome",
  ].map((p) => ({ url: `${BASE}${p}`, changeFrequency: "weekly" as const, priority: 0.8 }))

  const collectionEntries: { path: string; lastModified?: string }[] = [
    ...allPosts().map((p) => ({ path: `/blog/${p.slug}`, lastModified: `${p.date}T00:00:00Z` })),
    ...USE_CASES.map((u) => ({ path: `/use-cases/${u.slug}` })),
    ...COMPARISONS.map((c) => ({ path: `/compare/${c.slug}` })),
    ...LEGAL_DOCS.map((d) => ({ path: `/legal/${d.slug}`, lastModified: `${d.updated}T00:00:00Z` })),
    ...TOOLS.map((t) => ({ path: `/tools/${t.slug}` })),
  ]
  const collections: MetadataRoute.Sitemap = collectionEntries.map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified: r.lastModified,
    changeFrequency: "monthly",
    priority: 0.7,
  }))

  return [...top, ...collections]
}

export const revalidate = 3600

type Feed = {
  guides?: { shareId: string; updatedAt: string }[]
  showcases?: { slug: string; updatedAt: string }[]
  helpCenters?: { slug: string; updatedAt: string }[]
}

/**
 * /sitemap.xml — the marketing routes plus every published, indexable piece of
 * public content (guides, listed showcases, listed help centers), pulled from
 * the API's public sitemap feed. Falls back to static routes if the feed is
 * unavailable so the build never breaks.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    ...marketingRoutes(),
  ]

  let feed: Feed = {}
  try {
    const res = await fetch(`${API}/api/public/sitemap`, { next: { revalidate: 3600 } })
    if (res.ok) feed = (await res.json()) as Feed
  } catch {
    return staticRoutes
  }

  const guides: MetadataRoute.Sitemap = (feed.guides ?? []).map((g) => ({
    url: `${BASE}/g/${g.shareId}`,
    lastModified: g.updatedAt,
    changeFrequency: "monthly",
    priority: 0.7,
  }))
  const showcases: MetadataRoute.Sitemap = (feed.showcases ?? []).map((s) => ({
    url: `${BASE}/showcase/${s.slug}`,
    lastModified: s.updatedAt,
    changeFrequency: "monthly",
    priority: 0.7,
  }))
  const help: MetadataRoute.Sitemap = (feed.helpCenters ?? []).map((h) => ({
    url: `${BASE}/help/${h.slug}`,
    lastModified: h.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }))

  return [...staticRoutes, ...guides, ...showcases, ...help]
}
