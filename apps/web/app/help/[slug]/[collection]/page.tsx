import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { HelpCollection } from "@/components/help/help-site"
import { canonicalUrl } from "@/lib/canonical"
import { fetchHelpCollection } from "@/lib/public-help"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ slug: string; collection: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, collection } = await params
  const page = await fetchHelpCollection(slug, collection)
  if (!page) return { title: "Not found" }
  return {
    title: `${page.collection.name} · ${page.chrome.name}`,
    description: page.collection.description ?? undefined,
    alternates: { canonical: await canonicalUrl(`/help/${slug}/${collection}`) },
    robots: page.chrome.noindex ? { index: false, follow: false } : undefined,
  }
}

export default async function HelpCollectionPage({ params }: Params) {
  const { slug, collection } = await params
  const page = await fetchHelpCollection(slug, collection)
  if (!page) notFound()
  return <HelpCollection page={page} />
}
