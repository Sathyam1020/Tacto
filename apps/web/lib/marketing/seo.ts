import type { Metadata } from "next"

/** Canonical production origin — every marketing URL is absolute against this. */
export const SITE_URL = "https://tacto.fyi"

/**
 * Builds page-level Metadata for a marketing route: canonical URL, Open Graph,
 * and Twitter card, from one call. `title` is the page-specific part — the root
 * template appends " · Tacto" (so pass "Pricing", not "Pricing · Tacto").
 */
export function pageMeta({
  title,
  description,
  path,
  type = "website",
  ogTitle,
  ogDescription,
  publishedTime,
  tags,
}: {
  title: string
  description: string
  /** Absolute path from the site root, e.g. "/pricing". */
  path: string
  type?: "website" | "article"
  ogTitle?: string
  ogDescription?: string
  publishedTime?: string
  tags?: string[]
}): Metadata {
  const url = `${SITE_URL}${path}`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: ogTitle ?? title,
      description: ogDescription ?? description,
      url,
      type,
      siteName: "Tacto",
      ...(type === "article" && publishedTime ? { publishedTime, tags } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle ?? title,
      description: ogDescription ?? description,
    },
  }
}

/** Serialize a JSON-LD object for a <script type="application/ld+json"> tag. */
export function jsonLd(data: Record<string, unknown> | Record<string, unknown>[]): string {
  return JSON.stringify(data)
}
