import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PublicGuideView } from "@/components/public-guide-view"
import { fetchPublicGuide } from "@/lib/public-guide"

/**
 * Public shared guide — server-rendered for link previews (OG) and SEO.
 * Lives outside the (app) group, so no sidebar/navbar. 404s for unpublished
 * or unknown guides.
 */

type Params = { params: Promise<{ shareId: string }> }

export async function generateMetadata({
  params,
}: Params): Promise<Metadata> {
  const { shareId } = await params
  const guide = await fetchPublicGuide(shareId)
  if (!guide) return { title: "Guide not found" }
  return {
    title: guide.title,
    description: guide.summary ?? `A step-by-step guide by ${guide.workspaceName}.`,
    openGraph: {
      title: guide.title,
      description: guide.summary ?? undefined,
      type: "article",
    },
  }
}

export default async function PublicGuidePage({ params }: Params) {
  const { shareId } = await params
  const guide = await fetchPublicGuide(shareId)
  if (!guide) notFound()
  return <PublicGuideView guide={guide} />
}
