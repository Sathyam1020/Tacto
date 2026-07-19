import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og"
import { fetchShowcase } from "@/lib/public-showcase"

export const alt = "Tacto showcase"
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sc = await fetchShowcase(slug)
  return renderOgImage({ eyebrow: "Showcase", title: sc?.title ?? "A Tacto showcase" })
}
