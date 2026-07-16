import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { EmbedTheme } from "@/components/embed/embed-theme"
import type { ViewMode } from "@/components/guide-view"
import { PublicGuideView } from "@/components/public-guide-view"
import { fetchPublicGuide } from "@/lib/public-guide"

/**
 * Chromeless single-guide reader for iframing on third-party sites. Renders the
 * existing Guide Reader with no site chrome, driven by query params:
 *   mode=list|interactive · theme=light|dark|auto · lang=<code>
 * Published guides only; never indexed. Reads are attributed to `embed` and, via
 * the iframe's referrer, to the host site — through the existing GuideEvent log.
 */
export const dynamic = "force-dynamic"

type Params = {
  params: Promise<{ shareId: string }>
  searchParams: Promise<{ mode?: string; theme?: string; lang?: string }>
}

function asMode(m?: string): ViewMode | undefined {
  return m === "list" || m === "interactive" ? m : undefined
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { shareId } = await params
  const guide = await fetchPublicGuide(shareId)
  return {
    title: guide?.title ?? "Guide",
    robots: { index: false, follow: false },
  }
}

export default async function EmbedGuidePage({ params, searchParams }: Params) {
  const { shareId } = await params
  const { mode, theme, lang } = await searchParams
  const guide = await fetchPublicGuide(shareId)
  if (!guide) notFound()
  return (
    <div className="min-h-svh bg-background">
      <EmbedTheme theme={theme} />
      <PublicGuideView
        guide={guide}
        chromeless
        mode={asMode(mode)}
        lang={lang}
        sourceHost="embed"
      />
    </div>
  )
}
