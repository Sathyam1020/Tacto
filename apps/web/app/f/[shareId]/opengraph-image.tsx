import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og"
import { fetchPublicForm } from "@/lib/public-form"

export const alt = "Tacto form"
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params
  const form = await fetchPublicForm(shareId)
  return renderOgImage({ eyebrow: "Form", title: form?.title ?? "A Tacto form" })
}
