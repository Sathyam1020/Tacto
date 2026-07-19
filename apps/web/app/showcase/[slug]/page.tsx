import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ShowcaseView } from "@/components/showcase/view/showcase-view"
import { fetchShowcase } from "@/lib/public-showcase"

/** Public showcase — SSR, branded, in the owner's chosen layout. Reachable by
 *  slug (owner preview); `noindex` until published + listed. */
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const sc = await fetchShowcase(slug)
  if (!sc) return { title: "Showcase not found" }
  return {
    title: sc.title,
    description: sc.description ?? undefined,
    alternates: { canonical: `/showcase/${slug}` },
    openGraph: {
      title: sc.title,
      description: sc.description ?? undefined,
      url: `/showcase/${slug}`,
      type: "website",
    },
    robots: sc.noindex ? { index: false, follow: false } : undefined,
  }
}

export default async function ShowcasePage({ params }: Params) {
  const { slug } = await params
  const sc = await fetchShowcase(slug)
  if (!sc) notFound()
  return <ShowcaseView showcase={sc} />
}
