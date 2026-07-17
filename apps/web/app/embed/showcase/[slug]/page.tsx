import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { EmbedTheme } from "@/components/embed/embed-theme"
import { ShowcaseEmbedBridge } from "@/components/showcase/view/showcase-embed-bridge"
import { ShowcaseView } from "@/components/showcase/view/showcase-view"
import { fetchShowcase } from "@/lib/public-showcase"

/**
 * Chromeless Showcase viewer for iframing on third-party sites. Renders the
 * existing Showcase viewer with no site chrome, driven by query params:
 *   theme=light|dark|auto
 * Published showcases render normally; drafts render but are never indexed.
 * Engagement + per-guide reads flow through ShowcaseEvent / GuideEvent, and
 * lifecycle events are relayed to the host via `embed.js`.
 */
export const dynamic = "force-dynamic"

type Params = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ theme?: string }>
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const sc = await fetchShowcase(slug)
  return {
    title: sc?.title ?? "Showcase",
    robots: { index: false, follow: false },
  }
}

export default async function EmbedShowcasePage({ params, searchParams }: Params) {
  const { slug } = await params
  const { theme } = await searchParams
  const sc = await fetchShowcase(slug)
  if (!sc) notFound()
  return (
    <div className="min-h-svh bg-background">
      <EmbedTheme theme={theme} />
      <ShowcaseEmbedBridge slug={slug} />
      <ShowcaseView showcase={sc} embedded />
    </div>
  )
}
