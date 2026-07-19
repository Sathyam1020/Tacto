import type { Metadata } from "next"

/** Canonical production origin — every marketing URL is absolute against this.
 *  Driven by NEXT_PUBLIC_SITE_URL (same fallback as the root layout's
 *  metadataBase) so the domain lives in one place. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tacto.fyi"

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

/** BreadcrumbList JSON-LD from an ordered list of {name, path}. Paths are made
 *  absolute against SITE_URL. Improves SERP breadcrumbs and gives answer engines
 *  the page's place in the site hierarchy. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  }
}

/** FAQPage JSON-LD. Only emit when the same Q&As are visible on the page. */
export function faqPageJsonLd(faqs: { q: string; a: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  }
}
