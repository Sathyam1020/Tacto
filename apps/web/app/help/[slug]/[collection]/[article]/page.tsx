import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { HelpArticle } from "@/components/help/help-site"
import { canonicalUrl } from "@/lib/canonical"
import { fetchHelpArticle } from "@/lib/public-help"
import { fetchPublicGuide } from "@/lib/public-guide"
import { buildGuideJsonLd } from "@/lib/public-guide-schema"

/** A help-center article = a published guide, rendered by the Guide Reader
 *  inside the help-center chrome. */
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ slug: string; collection: string; article: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, collection, article } = await params
  const page = await fetchHelpArticle(slug, collection, article)
  if (!page) return { title: "Article not found" }
  return {
    title: `${page.article.title} · ${page.chrome.name}`,
    alternates: { canonical: await canonicalUrl(`/help/${slug}/${collection}/${article}`) },
    openGraph: { title: page.article.title, type: "article" },
    robots: page.chrome.noindex ? { index: false, follow: false } : undefined,
  }
}

export default async function HelpArticlePage({ params }: Params) {
  const { slug, collection, article } = await params
  const page = await fetchHelpArticle(slug, collection, article)
  if (!page) notFound()
  const guide = await fetchPublicGuide(page.guideShareId)
  if (!guide) notFound()
  // HowTo/FAQ structured data for indexable help articles. No @id: help centers
  // can run on customer domains, so we don't bake a tacto.fyi URL into it.
  const schema = page.chrome.noindex ? null : buildGuideJsonLd(guide)
  return (
    <>
      {schema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      )}
      <HelpArticle page={page} guide={guide} />
    </>
  )
}
