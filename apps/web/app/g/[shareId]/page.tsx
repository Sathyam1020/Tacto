import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PublicGuideView } from "@/components/public-guide-view"
import { fetchPublicGuide } from "@/lib/public-guide"
import { buildGuideJsonLd } from "@/lib/public-guide-schema"
import { SITE_URL } from "@/lib/marketing/seo"

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
    alternates: { canonical: `/g/${shareId}` },
    openGraph: {
      title: guide.title,
      description: guide.summary ?? undefined,
      url: `/g/${shareId}`,
      type: "article",
    },
  }
}

export default async function PublicGuidePage({ params }: Params) {
  const { shareId } = await params
  const guide = await fetchPublicGuide(shareId)
  if (!guide) notFound()
  const schema = buildGuideJsonLd(guide, { idUrl: `${SITE_URL}/g/${shareId}` })
  return (
    <>
      {schema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      )}
      <PublicGuideView guide={guide} />
    </>
  )
}

