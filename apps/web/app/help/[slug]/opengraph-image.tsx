import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og"
import { fetchHelpHome } from "@/lib/public-help"

export const alt = "Help center"
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const hc = await fetchHelpHome(slug)
  return renderOgImage({ eyebrow: "Help center", title: hc?.name ?? "Help center", footer: hc?.name ?? "tacto.fyi" })
}
