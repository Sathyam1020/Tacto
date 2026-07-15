import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { HelpHome } from "@/components/help/help-site"
import { fetchHelpHome } from "@/lib/public-help"

/** Public Help Center homepage — SSR for SEO. Lives outside (app): no chrome. */
type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const hc = await fetchHelpHome(slug)
  if (!hc) return { title: "Help center not found" }
  return {
    title: hc.name,
    description: hc.heroSubtitle ?? `Guides and answers for ${hc.name}.`,
    openGraph: { title: hc.name, description: hc.heroSubtitle ?? undefined, type: "website" },
    robots: hc.noindex ? { index: false, follow: false } : undefined,
  }
}

export default async function HelpHomePage({ params }: Params) {
  const { slug } = await params
  const hc = await fetchHelpHome(slug)
  if (!hc) notFound()
  return <HelpHome data={hc} />
}
