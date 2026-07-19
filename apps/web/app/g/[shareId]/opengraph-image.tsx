import { fetchPublicGuide } from "@/lib/public-guide"
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og"

export const alt = "Tacto guide"
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params
  const guide = await fetchPublicGuide(shareId)
  return renderOgImage({
    eyebrow: "Guide",
    title: guide?.title ?? "A step-by-step guide",
    footer: guide?.workspaceName ?? "tacto.fyi",
  })
}
