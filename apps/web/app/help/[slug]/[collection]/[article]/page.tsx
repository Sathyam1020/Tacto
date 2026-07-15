import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { HelpArticle } from "@/components/help/help-site"
import { fetchHelpArticle } from "@/lib/public-help"
import { fetchPublicGuide } from "@/lib/public-guide"

/** A help-center article = a published guide, rendered by the Guide Reader
 *  inside the help-center chrome. */
type Params = { params: Promise<{ slug: string; collection: string; article: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, collection, article } = await params
  const page = await fetchHelpArticle(slug, collection, article)
  if (!page) return { title: "Article not found" }
  return {
    title: `${page.article.title} · ${page.chrome.name}`,
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
  return <HelpArticle page={page} guide={guide} />
}
